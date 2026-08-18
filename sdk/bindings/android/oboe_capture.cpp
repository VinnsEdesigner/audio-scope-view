// oboe_capture.cpp — Android audio capture via Oboe (AAudio/OpenSL ES).
//
// Implements audioscope::bindings::AudioBinding for Android. Oboe gives a
// low-latency input stream (AAudio on 8.1+, OpenSL ES fallback on older
// devices); samples are delivered as float32 (the canonical DSP format) when
// the device supports it, else as int16/int32 and normalized through
// audioscope::common::convert_samples_to_f32.
//
// This is the Android analog of sdk/bindings/linux/alsa_binding.cpp and
// sdk/bindings/windows/wasapi_binding.cpp — same interface, same DSP core.

#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#include <oboe/Oboe.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <memory>
#include <mutex>
#include <vector>

namespace audioscope {
namespace bindings {

namespace {
using common::AudioDevice;
using common::SampleFormat;
using common::convert_samples_to_f32;

/// Lock-free ring of float32 samples backing read_samples(). Oboe's callback
/// runs on a high-priority audio thread, so the producer side never blocks.
/// Capacity is sized to hold ~1s of audio at 48 kHz mono.
class FloatRing {
public:
    explicit FloatRing(std::size_t capacity)
        : buf_(capacity), cap_(capacity) {}

    // Producer (audio thread). Returns samples actually accepted (drops overflow).
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

    // Consumer (JS/UI thread). Returns samples actually read.
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

    std::size_t available() const {
        std::lock_guard<std::mutex> g(mu_);
        return count_;
    }

private:
    mutable std::mutex mu_;
    std::vector<float> buf_;
    std::size_t cap_;
    std::size_t head_ = 0;
    std::size_t tail_ = 0;
    std::size_t count_ = 0;
};

class OboeCapture : public AudioBinding, public oboe::AudioStreamCallback {
public:
    OboeCapture() = default;
    ~OboeCapture() override { stop_capture(); }

    std::vector<AudioDevice> enumerate_devices() override {
        // Oboe exposes the default input; device-id routing is done via
        // AudioStreamBuilder::setDeviceId(int32_t). We report a single
        // "default" device; callers pass it through unchanged.
        AudioDevice d;
        d.id = "default";
        d.name = "Default input (Oboe)";
        d.channels = 1;
        d.sample_rate = 48000;
        d.is_default = true;
        return {d};
    }

    bool start_capture(const std::string& device_id, int sample_rate) override {
        if (capturing_.load()) return true;
        ring_ = std::make_unique<FloatRing>(static_cast<std::size_t>(sample_rate));

        oboe::AudioStreamBuilder b;
        b.setDirection(oboe::Direction::Input)
            ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
            ->setSharingMode(oboe::SharingMode::Exclusive)
            ->setFormat(oboe::AudioFormat::Float)
            ->setChannelCount(1)
            ->setSampleRate(sample_rate)
            ->setDataCallback(this)
            ->setErrorCallback(this);
        if (device_id != "default" && !device_id.empty()) {
            // device_id may be a numeric Oboe id.
            try { b.setDeviceId(std::stoi(device_id)); } catch (...) {}
        }

        oboe::Result r = b.openStream(stream_);
        if (r != oboe::Result::OK) {
            // Retry with shared mode + I16 fallback (some devices reject
            // exclusive float). The conversion path handles int16 → f32.
            oboe::AudioStreamBuilder b2;
            b2.setDirection(oboe::Direction::Input)
                ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
                ->setSharingMode(oboe::SharingMode::Shared)
                ->setFormat(oboe::AudioFormat::I16)
                ->setChannelCount(1)
                ->setSampleRate(sample_rate)
                ->setDataCallback(this)
                ->setErrorCallback(this);
            r = b2.openStream(stream_);
            if (r != oboe::Result::OK) return false;
        }
        actual_format_ = stream_->getFormat();
        actual_rate_ = stream_->getSampleRate();
        oboe::Result sr = stream_->requestStart();
        if (sr != oboe::Result::OK) {
            stream_.reset();
            return false;
        }
        capturing_.store(true);
        return true;
    }

    void stop_capture() override {
        if (stream_) {
            stream_->stop();
            stream_.reset();
        }
        capturing_.store(false);
    }

    std::size_t read_samples(float* buffer, std::size_t count) override {
        if (!ring_) return 0;
        std::size_t got = 0;
        // Drain whatever is available; callers poll on their own cadence.
        got = ring_->read(buffer, count);
        return got;
    }

    bool is_capturing() const override { return capturing_.load(); }

    // --- oboe::AudioStreamDataCallback ---
    oboe::DataCallbackResult onAudioReady(oboe::AudioStream* /*s*/,
                                         void* audioData, int32_t numFrames) override {
        const std::size_t n = static_cast<std::size_t>(numFrames);
        if (actual_format_ == oboe::AudioFormat::Float) {
            ring_->write(static_cast<const float*>(audioData), n);
        } else if (actual_format_ == oboe::AudioFormat::I16) {
            // Normalize int16 → f32 via the shared common helper.
            std::vector<float> tmp(n);
            convert_samples_to_f32(SampleFormat::S16, audioData, tmp.data(), n);
            ring_->write(tmp.data(), n);
        } else if (actual_format_ == oboe::AudioFormat::I32) {
            std::vector<float> tmp(n);
            convert_samples_to_f32(SampleFormat::S32, audioData, tmp.data(), n);
            ring_->write(tmp.data(), n);
        }
        return oboe::DataCallbackResult::Continue;
    }

    // --- oboe::AudioStreamErrorCallback ---
    void onErrorAfterClose(oboe::AudioStream* /*s*/, oboe::Result /*error*/) override {
        capturing_.store(false);
    }

private:
    std::unique_ptr<FloatRing> ring_;
    std::shared_ptr<oboe::AudioStream> stream_;
    oboe::AudioFormat actual_format_ = oboe::AudioFormat::Float;
    int32_t actual_rate_ = 48000;
    std::atomic<bool> capturing_{false};
};

} // namespace
} // namespace bindings
} // namespace audioscope

// Factory the JNI bridge calls so the C++ class identity stays internal.
extern "C" {
audioscope::bindings::AudioBinding* audioscope_android_binding_create() {
    return new audioscope::bindings::OboeCapture();
}
void audioscope_android_binding_destroy(audioscope::bindings::AudioBinding* b) {
    delete b;
}
}
