// pulse_binding.cpp — Linux audio capture via PulseAudio (simple API).
//
// Implements audioscope::bindings::AudioBinding for Linux desktop/native
// clients that prefer PulseAudio over raw ALSA (most desktop distros route
// through PulseAudio; this binding reaches the post-processed desktop mix).
// For headless / CI capture, pass device_id "auto_null.monitor" to capture
// the default sink's monitor stream (a virtual loopback).
//
// Uses pa_simple because it is a single blocking read loop — enough for
// scope-rate capture. The samples arrive as float32 (the canonical DSP
// format); int16 fallback is normalized through
// audioscope::common::convert_samples_to_f32.
//
// This is the Linux analog of:
//   - sdk/bindings/linux/alsa_binding.cpp (ALSA, same platform)
//   - sdk/bindings/android/oboe_capture.cpp (Android, Oboe)
//   - sdk/bindings/windows/wasapi_binding.cpp (Windows, WASAPI)

#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#include <pulse/error.h>
#include <pulse/simple.h>

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

class PulseCapture : public AudioBinding {
public:
    PulseCapture() = default;
    ~PulseCapture() override { stop_capture(); }

    std::vector<AudioDevice> enumerate_devices() override {
        // PulseAudio device enumeration normally goes through the async
        // introspection API; the simple API has no enumeration. We expose the
        // two well-known source names callers can route to, plus the default.
        // A full async enumerator can be layered on later without changing
        // the AudioBinding contract.
        AudioDevice def;
        def.id = "default";
        def.name = "Default source (PulseAudio)";
        def.channels = 1;
        def.sample_rate = 48000;
        def.is_default = true;

        AudioDevice monitor;
        monitor.id = "auto_null.monitor";
        monitor.name = "Null sink monitor (headless loopback)";
        monitor.channels = 1;
        monitor.sample_rate = 48000;
        return {def, monitor};
    }

    bool start_capture(const std::string& device_id, int sample_rate) override {
        if (capturing_.load()) return true;
        const int rate = sample_rate > 0 ? sample_rate : 48000;

        pa_sample_spec ss{};
        ss.format = PA_SAMPLE_FLOAT32LE;
        ss.rate = static_cast<std::uint32_t>(rate);
        ss.channels = 1;

        int err = 0;
        // An empty device_id ⇒ PA's configured default source.
        const char* src = device_id.empty() ? nullptr : device_id.c_str();
        simple_ = pa_simple_new(nullptr, "audioscope",
                                PA_STREAM_RECORD, src,
                                "audioscope capture", &ss, nullptr, nullptr, &err);
        if (!simple_) {
            // Retry with int16 — some embedded PA configs lack float32.
            ss.format = PA_SAMPLE_S16LE;
            err = 0;
            simple_ = pa_simple_new(nullptr, "audioscope",
                                    PA_STREAM_RECORD, src,
                                    "audioscope capture", &ss, nullptr, nullptr, &err);
            if (!simple_) return false;
            actual_s16_ = true;
        } else {
            actual_s16_ = false;
        }

        actual_rate_ = rate;
        ring_ = std::make_unique<FloatRing>(static_cast<std::size_t>(rate));
        capturing_.store(true);
        reader_ = std::thread(&PulseCapture::reader_loop, this);
        return true;
    }

    void stop_capture() override {
        capturing_.store(false);
        if (reader_.joinable()) reader_.join();
        if (simple_) {
            pa_simple_free(simple_);
            simple_ = nullptr;
        }
    }

    std::size_t read_samples(float* buffer, std::size_t count) override {
        if (!ring_) return 0;
        return ring_->read(buffer, count);
    }

    bool is_capturing() const override { return capturing_.load(); }

private:
    void reader_loop() {
        // Read 1024 frames per iteration (mono ⇒ 1024 samples).
        constexpr std::size_t frames = 1024;
        std::vector<float> fbuf(frames);
        std::vector<std::int16_t> sbuf(frames);
        int err = 0;
        while (capturing_.load() && simple_) {
            int got;
            if (actual_s16_) {
                got = pa_simple_read(simple_, sbuf.data(),
                                     frames * sizeof(std::int16_t), &err);
                if (got == 0) {
                    convert_samples_to_f32(SampleFormat::S16, sbuf.data(),
                                           fbuf.data(), frames);
                    ring_->write(fbuf.data(), frames);
                }
            } else {
                got = pa_simple_read(simple_, fbuf.data(),
                                     frames * sizeof(float), &err);
                if (got == 0) {
                    ring_->write(fbuf.data(), frames);
                }
            }
            if (got < 0) {
                // pa_simple_read returns -1 on error; stop the stream.
                capturing_.store(false);
            }
        }
    }

    std::unique_ptr<FloatRing> ring_;
    pa_simple* simple_ = nullptr;
    bool actual_s16_ = false;
    int actual_rate_ = 48000;
    std::atomic<bool> capturing_{false};
    std::thread reader_;
};

} // namespace
} // namespace bindings
} // namespace audioscope

extern "C" {
audioscope::bindings::AudioBinding* audioscope_linux_pulse_binding_create() {
    return new audioscope::bindings::PulseCapture();
}
void audioscope_linux_pulse_binding_destroy(audioscope::bindings::AudioBinding* b) {
    delete b;
}
}
