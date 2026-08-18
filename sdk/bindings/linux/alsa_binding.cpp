// alsa_binding.cpp — Linux audio capture via ALSA (snd_pcm_*).
//
// Implements audioscope::bindings::AudioBinding for Linux desktop/native
// clients. ALSA is the lowest-level Linux audio API; a capture stream is
// opened on a `hw:`/`default` PCM device, configured for mono float32 (or
// int16 fallback, normalized through audioscope::common::convert_samples_to_f32),
// and read on a background thread into a lock-free ring.
//
// This is the Linux analog of:
//   - sdk/bindings/android/oboe_capture.cpp     (Android, Oboe)
//   - sdk/bindings/windows/wasapi_binding.cpp   (Windows, WASAPI)
// Same AudioBinding interface, same DSP core — the platform choice is the
// only difference.

#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#include <alsa/asoundlib.h>

#include <atomic>
#include <chrono>
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

/// Mutex-guarded ring of float32 samples backing read_samples(). The ALSA
/// reader thread (producer) and the UI/JS thread (consumer) never share an
/// index without the lock; capacity is sized for ~1s of audio at 48 kHz.
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

class AlsaCapture : public AudioBinding {
public:
    AlsaCapture() = default;
    ~AlsaCapture() override { stop_capture(); }

    std::vector<AudioDevice> enumerate_devices() override {
        std::vector<AudioDevice> out;
        // snd_device_name_hint enumerates every PCM the ALSA config exposes.
        void** hints = nullptr;
        if (snd_device_name_hint(-1, "pcm", &hints) < 0) {
            return out;
        }
        bool first = true;
        for (void** h = hints; *h != nullptr; ++h) {
            char* ioid = snd_device_name_get_hint(*h, "IOID");
            // IOID "Input" ⇒ capture device; "Output" ⇒ playback; NULL ⇒ duplex.
            if (ioid != nullptr && std::strcmp(ioid, "Input") != 0) {
                free(ioid);
                continue;
            }
            free(ioid);

            char* name = snd_device_name_get_hint(*h, "NAME");
            char* desc = snd_device_name_get_hint(*h, "DESC");
            AudioDevice d;
            d.id = name ? name : "default";
            // DESC is "line1\nline2"; collapse to the first line for the name.
            if (desc != nullptr) {
                const char* nl = std::strchr(desc, '\n');
                d.name = nl ? std::string(desc, static_cast<std::size_t>(nl - desc))
                            : std::string(desc);
            } else {
                d.name = d.id;
            }
            d.channels = 1;
            d.sample_rate = 48000;
            d.is_default = first;
            first = false;
            out.push_back(d);
            free(name);
            free(desc);
        }
        snd_device_name_free_hint(hints);

        // ALSA always exposes "default" — guarantee it is present + flagged.
        if (out.empty()) {
            AudioDevice d;
            d.id = "default";
            d.name = "Default ALSA input";
            d.channels = 1;
            d.sample_rate = 48000;
            d.is_default = true;
            out.push_back(d);
        }
        return out;
    }

    bool start_capture(const std::string& device_id, int sample_rate) override {
        if (capturing_.load()) return true;
        const std::string& dev = device_id.empty() ? "default" : device_id;

        snd_pcm_t* handle = nullptr;
        int rc = snd_pcm_open(&handle, dev.c_str(),
                              SND_PCM_STREAM_CAPTURE, 0);
        if (rc < 0) return false;

        snd_pcm_hw_params_t* params = nullptr;
        snd_pcm_hw_params_alloca(&params);
        snd_pcm_hw_params_any(handle, params);

        // Prefer float32 LE (the canonical DSP format); fall back to int16.
        snd_pcm_format_t fmt = SND_PCM_FORMAT_FLOAT_LE;
        if (snd_pcm_hw_params_set_format(handle, params, fmt) < 0) {
            fmt = SND_PCM_FORMAT_S16_LE;
            if (snd_pcm_hw_params_set_format(handle, params, fmt) < 0) {
                snd_pcm_close(handle);
                return false;
            }
        }
        actual_format_ = fmt;

        unsigned int rate = static_cast<unsigned int>(sample_rate > 0 ? sample_rate : 48000);
        int dir = 0;
        snd_pcm_hw_params_set_rate_near(handle, params, &rate, &dir);
        actual_rate_ = static_cast<int>(rate);

        unsigned int channels = 1;
        snd_pcm_hw_params_set_channels(handle, params, channels);

        snd_pcm_uframes_t frames = 1024;
        snd_pcm_hw_params_set_period_size_near(handle, params, &frames, &dir);

        if (snd_pcm_hw_params(handle, params) < 0) {
            snd_pcm_close(handle);
            return false;
        }

        if (snd_pcm_prepare(handle) < 0) {
            snd_pcm_close(handle);
            return false;
        }

        pcm_ = handle;
        period_frames_ = frames;
        ring_ = std::make_unique<FloatRing>(static_cast<std::size_t>(rate));
        capturing_.store(true);
        reader_ = std::thread(&AlsaCapture::reader_loop, this);
        return true;
    }

    void stop_capture() override {
        capturing_.store(false);
        if (reader_.joinable()) reader_.join();
        if (pcm_) {
            snd_pcm_drain(pcm_);
            snd_pcm_close(pcm_);
            pcm_ = nullptr;
        }
    }

    std::size_t read_samples(float* buffer, std::size_t count) override {
        if (!ring_) return 0;
        return ring_->read(buffer, count);
    }

    bool is_capturing() const override { return capturing_.load(); }

private:
    void reader_loop() {
        const snd_pcm_format_t fmt = actual_format_;
        const std::size_t frames = period_frames_;
        // ALSA reads interleaved frames; mono ⇒ one sample per frame.
        std::vector<float> fbuf(frames);
        std::vector<std::int16_t> sbuf(frames);
        while (capturing_.load() && pcm_) {
            snd_pcm_sframes_t got;
            if (fmt == SND_PCM_FORMAT_FLOAT_LE) {
                got = snd_pcm_readi(pcm_, fbuf.data(), frames);
                if (got > 0) {
                    ring_->write(fbuf.data(), static_cast<std::size_t>(got));
                }
            } else {
                got = snd_pcm_readi(pcm_, sbuf.data(), frames);
                if (got > 0) {
                    convert_samples_to_f32(SampleFormat::S16, sbuf.data(),
                                           fbuf.data(), static_cast<std::size_t>(got));
                    ring_->write(fbuf.data(), static_cast<std::size_t>(got));
                }
            }
            if (got < 0) {
                // Underrun / suspend — recover and continue.
                snd_pcm_recover(pcm_, static_cast<int>(got), 1);
            }
        }
    }

    std::unique_ptr<FloatRing> ring_;
    snd_pcm_t* pcm_ = nullptr;
    snd_pcm_format_t actual_format_ = SND_PCM_FORMAT_FLOAT_LE;
    int actual_rate_ = 48000;
    snd_pcm_uframes_t period_frames_ = 1024;
    std::atomic<bool> capturing_{false};
    std::thread reader_;
};

} // namespace
} // namespace bindings
} // namespace audioscope

// Factory the host (CLI app / future Rust native-binding host) calls so the
// C++ class identity stays internal — mirrors oboe_capture.cpp's factory.
extern "C" {
audioscope::bindings::AudioBinding* audioscope_linux_alsa_binding_create() {
    return new audioscope::bindings::AlsaCapture();
}
void audioscope_linux_alsa_binding_destroy(audioscope::bindings::AudioBinding* b) {
    delete b;
}
}
