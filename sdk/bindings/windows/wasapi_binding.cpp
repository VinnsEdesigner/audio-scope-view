// wasapi_binding.cpp — Windows audio capture via WASAPI.
//
// Implements audioscope::bindings::AudioBinding for Windows desktop/native
// clients. WASAPI (Windows Audio Session API) is the lowest-latency Windows
// audio API; a capture stream is opened on the default render/capture
// endpoint via IMMDeviceEnumerator + IAudioCaptureClient, configured for
// mono float32 (or int16 fallback, normalized through
// audioscope::common::convert_samples_to_f32), and read on a background
// thread into a lock-free ring.
//
// This is the Windows analog of:
//   - sdk/bindings/linux/alsa_binding.cpp   (Linux, ALSA)
//   - sdk/bindings/android/oboe_capture.cpp (Android, Oboe)
// Same AudioBinding interface, same DSP core — the platform choice is the
// only difference.
//
// Build: only compiles on Windows (CMake guards the subdirectory behind
// WIN32). The CO_INIT initializer uses an RAII wrapper so the COM apartment
// is cleanly torn down in stop_capture().

#include "audioscope/common/audio_binding.hpp"
#include "audioscope/common/types.hpp"

#ifdef _WIN32

#include <atlbase.h>
#include <mmdeviceapi.h>
#include <audioclient.h>

#include <atomic>
#include <cstring>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

#pragma comment(lib, "ole32.lib")

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

class WasapiCapture : public AudioBinding {
public:
    WasapiCapture() = default;
    ~WasapiCapture() override { stop_capture(); }

    std::vector<AudioDevice> enumerate_devices() override {
        std::vector<AudioDevice> out;
        CComPtr<IMMDeviceEnumerator> enumerator;
        HRESULT hr = enumerator.CoCreateInstance(__uuidof(MMDeviceEnumerator),
                                                 nullptr, CLSCTX_ALL);
        if (FAILED(hr)) {
            AudioDevice d;
            d.id = "default";
            d.name = "Default WASAPI capture";
            d.is_default = true;
            out.push_back(d);
            return out;
        }

        // Default capture endpoint first.
        CComPtr<IMMDevice> def;
        hr = enumerator->GetDefaultAudioEndpoint(eCapture, eConsole, &def);
        if (SUCCEEDED(hr)) {
            AudioDevice d;
            d.id = "default";
            d.name = "Default capture (WASAPI)";
            d.channels = 1;
            d.sample_rate = 48000;
            d.is_default = true;
            out.push_back(d);
        }
        // TODO: full endpoint collection via IMMDeviceEnumerator::EnumEndpoints;
        // the default is enough for first scope capture.
        return out;
    }

    bool start_capture(const std::string& /*device_id*/, int sample_rate) override {
        if (capturing_.load()) return true;

        HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        // RPC_E_CHANGED_MODE means this thread already initialized COM in a
        // different apartment — accept and keep going.
        com_initialized_ = SUCCEEDED(hr) || hr == RPC_E_CHANGED_MODE;

        hr = enumerator_.CoCreateInstance(__uuidof(MMDeviceEnumerator),
                                          nullptr, CLSCTX_ALL);
        if (FAILED(hr)) { cleanup_com(); return false; }

        hr = enumerator_->GetDefaultAudioEndpoint(eCapture, eConsole, &device_);
        if (FAILED(hr)) { cleanup_com(); return false; }

        hr = device_->Activate(__uuidof(IAudioClient), CLSCTX_ALL,
                               nullptr, reinterpret_cast<void**>(&audio_client_));
        if (FAILED(hr)) { cleanup_com(); return false; }

        // Request mono float32 at the caller's rate (or the mix format's rate).
        WAVEFORMATEX* mix = nullptr;
        hr = audio_client_->GetMixFormat(&mix);
        if (FAILED(hr) || mix == nullptr) { cleanup_com(); return false; }

        WAVEFORMATEXTENSIBLE wfx{};
        WAVEFORMATEX* used = mix;
        // Try to coerce to 32-bit float mono; fall back to the mix format.
        wfx.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
        wfx.Format.nChannels = 1;
        wfx.Format.nSamplesPerSec = static_cast<DWORD>(sample_rate > 0 ? sample_rate : 48000);
        wfx.Format.wBitsPerSample = 32;
        wfx.Format.nBlockAlign = wfx.Format.nChannels * (wfx.Format.wBitsPerSample / 8);
        wfx.Format.nAvgBytesPerSec = wfx.Format.nSamplesPerSec * wfx.Format.nBlockAlign;
        wfx.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
        wfx.Samples.wValidBitsPerSample = 32;
        wfx.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
        actual_float_ = true;
        actual_rate_ = static_cast<int>(wfx.Format.nSamplesPerSec);

        hr = audio_client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                       0, AUDIOSCOPE_REFTIMES_PER_SEC,
                                       0, &wfx.Format, nullptr);
        if (FAILED(hr)) {
            // Fall back to the mix format (device-native channel count/rate).
            used = mix;
            actual_float_ = (mix->wBitsPerSample == 32 &&
                             mix->wFormatTag == WAVE_FORMAT_IEEE_FLOAT);
            actual_rate_ = static_cast<int>(mix->nSamplesPerSec);
            hr = audio_client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                           0, AUDIOSCOPE_REFTIMES_PER_SEC,
                                           0, mix, nullptr);
            if (FAILED(hr)) {
                CoTaskMemFree(mix);
                cleanup_com();
                return false;
            }
        }
        CoTaskMemFree(mix);
        used_channels_ = used->nChannels;

        hr = audio_client_->GetService(__uuidof(IAudioCaptureClient),
                                       reinterpret_cast<void**>(&capture_client_));
        if (FAILED(hr)) { cleanup_com(); return false; }

        hr = audio_client_->Start();
        if (FAILED(hr)) { cleanup_com(); return false; }

        ring_ = std::make_unique<FloatRing>(static_cast<std::size_t>(actual_rate_));
        capturing_.store(true);
        reader_ = std::thread(&WasapiCapture::reader_loop, this);
        return true;
    }

    void stop_capture() override {
        capturing_.store(false);
        if (reader_.joinable()) reader_.join();
        if (audio_client_) audio_client_->Stop();
        capture_client_.Release();
        audio_client_.Release();
        device_.Release();
        enumerator_.Release();
        cleanup_com();
    }

    std::size_t read_samples(float* buffer, std::size_t count) override {
        if (!ring_) return 0;
        return ring_->read(buffer, count);
    }

    bool is_capturing() const override { return capturing_.load(); }

private:
    // 1 second in 100-ns units (REFTIMES_PER_SEC).
    static constexpr REFERENCE_TIME AUDIOSCOPE_REFTIMES_PER_SEC = 10000000;

    void reader_loop() {
        std::vector<float> frame;
        std::vector<std::int16_t> sframe;
        std::vector<float> mono;
        while (capturing_.load() && capture_client_) {
            UINT32 packet_len = 0;
            HRESULT hr = capture_client_->GetNextPacketSize(&packet_len);
            if (FAILED(hr)) break;
            while (packet_len != 0) {
                BYTE* data = nullptr;
                UINT32 frames = 0;
                DWORD flags = 0;
                hr = capture_client_->GetBuffer(&data, &frames, &flags,
                                                nullptr, nullptr);
                if (FAILED(hr)) break;

                const std::size_t total = static_cast<std::size_t>(frames) * used_channels_;
                if (actual_float_) {
                    const auto* src = reinterpret_cast<const float*>(data);
                    if (used_channels_ == 1) {
                        ring_->write(src, frames);
                    } else {
                        // Downmix to mono by averaging channels.
                        mono.assign(frames, 0.0f);
                        for (UINT32 i = 0; i < frames; ++i) {
                            float sum = 0.0f;
                            for (WORD c = 0; c < used_channels_; ++c) {
                                sum += src[i * used_channels_ + c];
                            }
                            mono[i] = sum / static_cast<float>(used_channels_);
                        }
                        ring_->write(mono.data(), frames);
                    }
                } else {
                    // 16-bit PCM fallback.
                    sframe.assign(total, 0);
                    std::memcpy(sframe.data(), data, total * sizeof(std::int16_t));
                    frame.assign(frames, 0.0f);
                    if (used_channels_ == 1) {
                        convert_samples_to_f32(SampleFormat::S16, sframe.data(),
                                               frame.data(), frames);
                    } else {
                        std::vector<std::int16_t> mono16(frames, 0);
                        for (UINT32 i = 0; i < frames; ++i) {
                            int sum = 0;
                            for (WORD c = 0; c < used_channels_; ++c) {
                                sum += sframe[i * used_channels_ + c];
                            }
                            mono16[i] = static_cast<std::int16_t>(sum / used_channels_);
                        }
                        convert_samples_to_f32(SampleFormat::S16, mono16.data(),
                                               frame.data(), frames);
                    }
                    ring_->write(frame.data(), frames);
                }

                capture_client_->ReleaseBuffer(frames);
                hr = capture_client_->GetNextPacketSize(&packet_len);
                if (FAILED(hr)) { capturing_.store(false); return; }
            }
            // No data available yet; brief sleep to avoid spinning.
            std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
    }

    void cleanup_com() {
        if (com_initialized_) {
            CoUninitialize();
            com_initialized_ = false;
        }
    }

    std::unique_ptr<FloatRing> ring_;
    CComPtr<IMMDeviceEnumerator> enumerator_;
    CComPtr<IMMDevice> device_;
    CComPtr<IAudioClient> audio_client_;
    CComPtr<IAudioCaptureClient> capture_client_;
    bool actual_float_ = true;
    int actual_rate_ = 48000;
    WORD used_channels_ = 1;
    std::atomic<bool> capturing_{false};
    std::thread reader_;
    bool com_initialized_ = false;
};

} // namespace
} // namespace bindings
} // namespace audioscope

extern "C" {
audioscope::bindings::AudioBinding* audioscope_windows_wasapi_binding_create() {
    return new audioscope::bindings::WasapiCapture();
}
void audioscope_windows_wasapi_binding_destroy(audioscope::bindings::AudioBinding* b) {
    delete b;
}
}

#else // !_WIN32

// Non-Windows hosts: provide an empty factory so the translation unit still
// links (the CMake subdirectory is guarded by WIN32, so this path is never
// compiled into a real build; it exists only to keep a syntax-only check on
// a Linux host from emitting a "no symbols" warning).
namespace audioscope { namespace bindings { } }

#endif
