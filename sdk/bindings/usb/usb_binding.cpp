// usb_binding.cpp — host AudioBinding over libusb (the "bare" ESP32 path).
//
// Implements audioscope::bindings::AudioBinding by talking the custom
// audioscope USB vendor-class protocol directly via libusb — it does NOT go
// through ALSA/WASAPI/CoreAudio. The ESP32 presents a custom USB device
// (VID 0x1209 / PID 0xA500); this binding opens it, claims the interface,
// sends control packets (START/STOP/SET_RATE/...), and reads sample frames
// off the bulk-IN endpoint on a background thread into a FloatRing.
//
// Samples arrive in the device's native format (S16/S24/S32/F32) and are
// normalized to float32 via the shared audioscope::common::convert_samples_to_f32,
// so the DSP core sees the same canonical format from every binding.
//
// This is the host analog of:
//   - sdk/bindings/linux/alsa_binding.cpp   (Linux, ALSA)
//   - sdk/bindings/linux/pulse_binding.cpp   (Linux, PulseAudio)
//   - sdk/bindings/windows/wasapi_binding.cpp (Windows, WASAPI)
//   - sdk/bindings/android/oboe_capture.cpp (Android, Oboe)
// Same AudioBinding interface, same DSP core — the transport is the only
// difference. Where the others bind to an OS audio API, this one binds to
// the USB device directly.

#include "usb_binding.h"
#include "usb_protocol.h"
#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#include <libusb-1.0/libusb.h>

#include <atomic>
#include <cstring>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

namespace audioscope {
namespace bindings {

namespace {
using common::AudioDevice;
using common::SampleFormat;
using common::convert_samples_to_f32;

class FloatRing {
public:
    explicit FloatRing(std::size_t capacity)
        : buf_(capacity), cap_(capacity) {}

    std::size_t write(const float* src, std::size_t n) {
        std::lock_guard<std::mutex> g(mu_);
        std::size_t free = cap_ - count_;
        std::size_t take = std::min(n, free);
        for (std::size_t i = 0; i < take; ++i) {
            buf_[(head_ + i) % cap_] = src[i];
        }
        head_ = (head_ + take) % cap_;
        count_ += take;
        return take;
    }

    std::size_t read(float* dst, std::size_t n) {
        std::lock_guard<std::mutex> g(mu_);
        std::size_t take = std::min(n, count_);
        for (std::size_t i = 0; i < take; ++i) {
            dst[i] = buf_[(tail_ + i) % cap_];
        }
        tail_ = (tail_ + take) % cap_;
        count_ -= take;
        return take;
    }

private:
    mutable std::mutex mu_;
    std::vector<float> buf_;
    std::size_t cap_;
    std::size_t head_ = 0;
    std::size_t tail_ = 0;
    std::size_t count_ = 0;
};

// Wrap libusb's refcounted device handle + the codec/format we negotiated.
struct UsbDevice {
    libusb_device_handle* handle = nullptr;
    as_usb_device_info info{};
    as_usb_bandwidth_info bw{};
    SampleFormat fmt = SampleFormat::S16;
    int actual_rate = 48000;
    unsigned channels = 1;
};

class UsbCapture : public AudioBinding {
public:
    UsbCapture() {
        // One libusb context per binding (cheap; simplifies teardown).
        if (libusb_init(&ctx_) == 0) ctx_ok_ = true;
    }
    ~UsbCapture() override { stop_capture(); if (ctx_) libusb_exit(ctx_); }

    std::vector<AudioDevice> enumerate_devices() override {
        std::vector<AudioDevice> out;
        if (!ctx_ok_) return out;

        libusb_device** list = nullptr;
        ssize_t n = libusb_get_device_list(ctx_, &list);
        if (n < 0) return out;

        bool first = true;
        for (ssize_t i = 0; i < n; ++i) {
            libusb_device_descriptor desc;
            if (libusb_get_device_descriptor(list[i], &desc) != 0) continue;
            if (desc.idVendor != AUDIOSCOPE_USB_VID ||
                desc.idProduct != AUDIOSCOPE_USB_PID) {
                continue;
            }
            // Open briefly to GET_INFO (best effort; tolerate busy devices).
            libusb_device_handle* h = nullptr;
            if (libusb_open(list[i], &h) != 0) continue;
            as_usb_device_info info{};
            if (get_info(h, info)) {
                AudioDevice d;
                d.id = std::to_string(libusb_get_device_address(list[i]));
                d.name = reinterpret_cast<const char*>(info.name);
                if (d.name.empty()) d.name = "Audioscope USB device";
                d.channels = static_cast<uint32_t>(info.channels);
                d.sample_rate = info.max_sample_rate ? info.max_sample_rate : 48000;
                d.is_default = first;
                first = false;
                out.push_back(d);
            }
            libusb_close(h);
        }
        libusb_free_device_list(list, 1);

        // No device present is a normal headless state — return empty.
        return out;
    }

    bool start_capture(const std::string& device_id, int sample_rate) override {
        if (capturing_.load()) return true;
        if (!ctx_ok_) return false;

        libusb_device** list = nullptr;
        ssize_t n = libusb_get_device_list(ctx_, &list);
        if (n < 0) return false;

        libusb_device_handle* h = nullptr;
        for (ssize_t i = 0; i < n; ++i) {
            libusb_device_descriptor desc;
            if (libusb_get_device_descriptor(list[i], &desc) != 0) continue;
            if (desc.idVendor != AUDIOSCOPE_USB_VID ||
                desc.idProduct != AUDIOSCOPE_USB_PID) continue;
            if (!device_id.empty() && device_id != "default" &&
                device_id != std::to_string(libusb_get_device_address(list[i]))) {
                continue;
            }
            if (libusb_open(list[i], &h) == 0) break;
            h = nullptr;
        }
        libusb_free_device_list(list, 1);
        if (!h) return false;

        dev_ = std::make_unique<UsbDevice>();
        dev_->handle = h;
        if (!get_info(h, dev_->info)) { libusb_close(h); dev_.reset(); return false; }
        dev_->fmt = native_format(dev_->info.sample_format);
        dev_->actual_rate = sample_rate > 0 ? sample_rate : static_cast<int>(dev_->info.max_sample_rate);
        dev_->channels = dev_->info.channels ? dev_->info.channels : 1;
        // Query the real ADC bandwidth so the host presents truthful scope ranges.
        get_bandwidth(h, dev_->bw);
        cap_.adc_max_rate_hz = dev_->bw.adc_max_rate;
        cap_.analog_bw_hz = dev_->bw.analog_bw_hz;
        cap_.effective_bw_hz = dev_->bw.effective_bw_hz;
        cap_.resolution_bits = dev_->bw.resolution_bits;
        cap_.vrange_mv = dev_->bw.vrange_mv;
        cap_.gen_max_freq_hz = dev_->bw.gen_max_freq_hz;
        cap_.gen_resolution_bits = dev_->bw.gen_resolution_bits;

        if (libusb_claim_interface(h, 0) != 0) {
            libusb_close(h); dev_.reset(); return false;
        }
        if (!set_rate(dev_->actual_rate) || !set_channels(dev_->channels)) {
            libusb_release_interface(h, 0); libusb_close(h); dev_.reset(); return false;
        }
        if (!send_cmd(AS_USB_CMD_START_STREAM, nullptr, 0)) {
            libusb_release_interface(h, 0); libusb_close(h); dev_.reset(); return false;
        }

        ring_ = std::make_unique<FloatRing>(static_cast<std::size_t>(dev_->actual_rate));
        capturing_.store(true);
        reader_ = std::thread(&UsbCapture::reader_loop, this);
        return true;
    }

    void stop_capture() override {
        capturing_.store(false);
        if (reader_.joinable()) reader_.join();
        if (dev_) {
            send_cmd(AS_USB_CMD_STOP_STREAM, nullptr, 0);
            libusb_release_interface(dev_->handle, 0);
            libusb_close(dev_->handle);
            dev_.reset();
        }
    }

    std::size_t read_samples(float* buffer, std::size_t count) override {
        if (!ring_) return 0;
        return ring_->read(buffer, count);
    }

    bool is_capturing() const override { return capturing_.load(); }

    // --- scope + generator overrides ---
    ScopeCapability scope_capability() const override { return cap_; }
    bool supports_generator() const override { return true; }

    bool set_trigger(common::TriggerEdge edge, float level_v,
                     std::uint32_t holdoff_us) override {
        as_usb_cmd_set_trigger p{};
        p.edge = static_cast<uint8_t>(edge);
        p.source = 0;
        p.level_milli = static_cast<uint16_t>(static_cast<int16_t>(level_v * 1000.0f));
        p.holdoff_us = holdoff_us;
        return send_cmd(AS_USB_CMD_SET_TRIGGER, &p, sizeof(p));
    }
    bool set_vertical(float volts_per_div, common::Coupling c) override {
        as_usb_cmd_set_vscale vp{};
        vp.mv_per_div = static_cast<uint32_t>(volts_per_div * 1000.0f);
        if (!send_cmd(AS_USB_CMD_SET_VSCALE, &vp, sizeof(vp))) return false;
        as_usb_cmd_set_coupling cp{};
        cp.coupling = static_cast<uint32_t>(c);
        return send_cmd(AS_USB_CMD_SET_COUPLING, &cp, sizeof(cp));
    }
    bool set_timebase(std::uint32_t ns_per_div) override {
        as_usb_cmd_set_timebase p{ns_per_div};
        return send_cmd(AS_USB_CMD_SET_TIMEBASE, &p, sizeof(p));
    }
    bool generator_start(common::Waveform w, std::uint64_t freq_hz,
                         std::uint32_t amp_mv, int32_t offset_mv,
                         std::uint32_t duty_permille) override {
        as_usb_cmd_gen_set_wave wp{static_cast<uint32_t>(w)};
        as_usb_cmd_gen_set_freq fp{freq_hz};
        as_usb_cmd_gen_set_amp ap{amp_mv};
        as_usb_cmd_gen_set_offset op{offset_mv};
        as_usb_cmd_gen_set_duty dp{duty_permille};
        if (!send_cmd(AS_USB_CMD_GEN_SET_WAVE, &wp, sizeof(wp))) return false;
        if (!send_cmd(AS_USB_CMD_GEN_SET_FREQ, &fp, sizeof(fp))) return false;
        if (!send_cmd(AS_USB_CMD_GEN_SET_AMP, &ap, sizeof(ap))) return false;
        if (!send_cmd(AS_USB_CMD_GEN_SET_OFFSET, &op, sizeof(op))) return false;
        if (!send_cmd(AS_USB_CMD_GEN_SET_DUTY, &dp, sizeof(dp))) return false;
        return send_cmd(AS_USB_CMD_GEN_START, nullptr, 0);
    }
    bool generator_stop() override {
        return send_cmd(AS_USB_CMD_GEN_STOP, nullptr, 0);
    }

private:
    // --- control channel helpers (EP0 vendor request + bulk-OUT) ---
    bool get_info(libusb_device_handle* h, as_usb_device_info& out) {
        as_usb_cmd_header req{};
        req.magic[0] = AUDIOSCOPE_USB_MAGIC0;
        req.magic[1] = AUDIOSCOPE_USB_MAGIC1;
        req.cmd = AS_USB_CMD_GET_INFO;
        req.payload_len = 0;
        req.seq = ++seq_;
        req.crc = as_usb_crc16(reinterpret_cast<const uint8_t*>(&req), 12);
        // Send the 16-byte header as a control vendor request.
        int sent = 0;
        int r = libusb_control_transfer(h, 0x40 /*OUT,vendor*/,
                                        0, 0, 0,
                                        reinterpret_cast<unsigned char*>(&req), 16, 1000);
        if (r != 16) (void)sent;
        // Read the response: 16-byte header + 64-byte info.
        uint8_t buf[16 + 64] = {};
        r = libusb_control_transfer(h, 0xC0 /*IN,vendor*/,
                                    0, 0, 0, buf, sizeof(buf), 1000);
        if (r != (int)sizeof(buf)) return false;
        as_usb_rsp_header rsp{};
        std::memcpy(&rsp, buf, 16);
        if (rsp.status != AS_USB_STATUS_OK || rsp.payload_len != 64) return false;
        std::memcpy(&out, buf + 16, 64);
        return true;
    }

    bool get_bandwidth(libusb_device_handle* h, as_usb_bandwidth_info& out) {
        as_usb_cmd_header req{};
        req.magic[0] = AUDIOSCOPE_USB_MAGIC0;
        req.magic[1] = AUDIOSCOPE_USB_MAGIC1;
        req.cmd = AS_USB_CMD_GET_BANDWIDTH;
        req.seq = ++seq_;
        req.crc = as_usb_crc16(reinterpret_cast<const uint8_t*>(&req), 12);
        int r = libusb_control_transfer(h, 0x40, 0, 0, 0,
                                        reinterpret_cast<unsigned char*>(&req), 16, 1000);
        if (r != 16) return false;
        uint8_t buf[16 + 32] = {};
        r = libusb_control_transfer(h, 0xC0, 0, 0, 0, buf, sizeof(buf), 1000);
        if (r != (int)sizeof(buf)) return false;
        as_usb_rsp_header rsp{};
        std::memcpy(&rsp, buf, 16);
        if (rsp.status != AS_USB_STATUS_OK || rsp.payload_len != 32) return false;
        std::memcpy(&out, buf + 16, 32);
        return true;
    }

    bool send_cmd(uint8_t cmd, const void* payload, uint32_t payload_len) {
        if (!dev_ || !dev_->handle) return false;
        std::vector<uint8_t> pkt(16 + payload_len);
        as_usb_cmd_header* hdr = reinterpret_cast<as_usb_cmd_header*>(pkt.data());
        hdr->magic[0] = AUDIOSCOPE_USB_MAGIC0;
        hdr->magic[1] = AUDIOSCOPE_USB_MAGIC1;
        hdr->cmd = cmd;
        hdr->payload_len = payload_len;
        hdr->seq = ++seq_;
        hdr->crc = as_usb_crc16(pkt.data(), 12);
        if (payload_len && payload) {
            std::memcpy(pkt.data() + 16, payload, payload_len);
        }
        int r = libusb_control_transfer(dev_->handle, 0x40, 0, 0, 0,
                                        pkt.data(), (uint16_t)pkt.size(), 1000);
        return r == (int)pkt.size();
    }

    bool set_rate(int rate) {
        as_usb_cmd_set_rate p{static_cast<uint32_t>(rate)};
        return send_cmd(AS_USB_CMD_SET_RATE, &p, sizeof(p));
    }
    bool set_channels(unsigned ch) {
        as_usb_cmd_set_channels p{static_cast<uint32_t>(ch)};
        return send_cmd(AS_USB_CMD_SET_CHANNELS, &p, sizeof(p));
    }

    static SampleFormat native_format(uint32_t f) {
        switch (f) {
            case AS_USB_FMT_F32: return SampleFormat::F32;
            case AS_USB_FMT_S16: return SampleFormat::S16;
            case AS_USB_FMT_S24:
            case AS_USB_FMT_S32: return SampleFormat::S32;
            default: return SampleFormat::S16;
        }
    }

    // --- stream reader (bulk-IN) ---
    void reader_loop() {
        constexpr int EP_IN = 0x81;  // bulk IN, interface 0
        constexpr int MAX_PKT = 512;
        std::vector<uint8_t> raw(MAX_PKT);
        std::vector<float> f32(MAX_PKT);
        while (capturing_.load() && dev_) {
            int got = 0;
            int r = libusb_bulk_transfer(dev_->handle, EP_IN,
                                         raw.data(), MAX_PKT, &got, 100);
            if (r == LIBUSB_ERROR_TIMEOUT) continue;
            if (r != 0) { capturing_.store(false); return; }
            if (got < (int)sizeof(as_usb_stream_header)) continue;
            as_usb_stream_header sh{};
            std::memcpy(&sh, raw.data(), sizeof(sh));
            if (sh.magic != AS_USB_STREAM_MAGIC) continue;
            // Number of sample BYTES after the header.
            const std::size_t bytes = got - sizeof(sh);
            const std::size_t per = dev_->info.frame_size ? dev_->info.frame_size : 2;
            if (per == 0) continue;
            std::size_t nsamp = bytes / per;
            if (nsamp == 0) continue;
            // Normalize native PCM → float32 (mono: de-interleave if needed).
            if (dev_->channels == 1) {
                convert_samples_to_f32(dev_->fmt, raw.data() + sizeof(sh),
                                       f32.data(), nsamp);
                ring_->write(f32.data(), nsamp);
            } else {
                // Downmix to mono by averaging channels.
                std::vector<float> all(nsamp);
                convert_samples_to_f32(dev_->fmt, raw.data() + sizeof(sh),
                                       all.data(), nsamp);
                std::size_t frames = nsamp / dev_->channels;
                std::vector<float> mono(frames);
                for (std::size_t i = 0; i < frames; ++i) {
                    float s = 0.0f;
                    for (unsigned c = 0; c < dev_->channels; ++c) s += all[i * dev_->channels + c];
                    mono[i] = s / static_cast<float>(dev_->channels);
                }
                ring_->write(mono.data(), frames);
            }
        }
    }

    libusb_context* ctx_ = nullptr;
    bool ctx_ok_ = false;
    std::unique_ptr<UsbDevice> dev_;
    std::unique_ptr<FloatRing> ring_;
    std::atomic<bool> capturing_{false};
    std::thread reader_;
    uint32_t seq_ = 0;
    ScopeCapability cap_{};
};

} // namespace
} // namespace bindings
} // namespace audioscope

extern "C" {
audioscope::bindings::AudioBinding* audioscope_usb_binding_create() {
    return new audioscope::bindings::UsbCapture();
}
void audioscope_usb_binding_destroy(audioscope::bindings::AudioBinding* b) {
    delete b;
}
}

namespace audioscope { namespace bindings {
AudioBinding* create_usb_binding() { return audioscope_usb_binding_create(); }
}}
