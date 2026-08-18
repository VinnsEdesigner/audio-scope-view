// test_common.cpp — unit tests for sdk/common (ring buffer, pool allocator,
// config JSON/validation, sample-format conversion). These keep the `common`
// layer honest independently of the DSP core: parity is not the point here,
// correctness of the shared infrastructure is.
#include "audioscope/common/buffer.hpp"
#include "audioscope/common/config.hpp"
#include "audioscope/common/types.hpp"

#include <gtest/gtest.h>

#include <atomic>
#include <string>
#include <thread>
#include <vector>

using audioscope::common::AudioRingBuffer;
using audioscope::common::DspConfig;
using audioscope::common::PoolAllocator;
using audioscope::common::SampleFormat;
using audioscope::common::WindowType;

// ---------------- AudioRingBuffer ----------------

TEST(RingBuffer, PushDrainRoundTrip) {
    AudioRingBuffer rb(8);
    float in[] = {1, 2, 3, 4};
    EXPECT_EQ(rb.push(in, 4), 4u);
    EXPECT_EQ(rb.available(), 4u);

    float out[4] = {0};
    EXPECT_EQ(rb.drain(out, 4), 4u);
    EXPECT_FLOAT_EQ(out[0], 1.0f);
    EXPECT_FLOAT_EQ(out[3], 4.0f);
    EXPECT_EQ(rb.available(), 0u);
}

TEST(RingBuffer, CapacityBackpressureDropsOverflow) {
    AudioRingBuffer rb(4);
    float in[] = {1, 2, 3, 4, 5, 6};
    // capacity is 4, so only 4 fit; push returns the count actually written.
    EXPECT_EQ(rb.push(in, 6), 4u);
    EXPECT_EQ(rb.available(), 4u);
}

TEST(RingBuffer, WrapsAroundAfterDrain) {
    AudioRingBuffer rb(3);
    float a[] = {10, 20, 30};
    EXPECT_EQ(rb.push(a, 3), 3u);
    float out1[2] = {0};
    EXPECT_EQ(rb.drain(out1, 2), 2u);
    EXPECT_FLOAT_EQ(out1[0], 10.0f);
    EXPECT_FLOAT_EQ(out1[1], 20.0f);

    float b[] = {40, 50};
    EXPECT_EQ(rb.push(b, 2), 2u); // wraps past the physical end

    float out2[3] = {0};
    EXPECT_EQ(rb.drain(out2, 3), 3u);
    EXPECT_FLOAT_EQ(out2[0], 30.0f);
    EXPECT_FLOAT_EQ(out2[1], 40.0f);
    EXPECT_FLOAT_EQ(out2[2], 50.0f);
}

TEST(RingBuffer, ClearEmpties) {
    AudioRingBuffer rb(4);
    float in[] = {1, 2};
    rb.push(in, 2);
    EXPECT_EQ(rb.available(), 2u);
    rb.clear();
    EXPECT_EQ(rb.available(), 0u);
}

TEST(RingBuffer, ConcurrentProducerConsumer) {
    AudioRingBuffer rb(1024);
    constexpr int N = 10000;
    std::atomic<int> produced{0}, consumed{0};

    std::thread producer([&] {
        for (int i = 0; i < N; ++i) {
            float v = static_cast<float>(i);
            while (rb.push(&v, 1) == 0) {
                // spin until space frees up
            }
            produced.fetch_add(1, std::memory_order_relaxed);
        }
    });

    std::thread consumer([&] {
        std::vector<float> got;
        got.reserve(N);
        while (consumed.load() < N) {
            float v = 0;
            std::size_t n = rb.drain(&v, 1);
            if (n > 0) {
                got.push_back(v);
                consumed.fetch_add(1, std::memory_order_relaxed);
            }
        }
        // No samples lost, and order is preserved (SPSC FIFO).
        ASSERT_EQ(got.size(), static_cast<std::size_t>(N));
        for (int i = 0; i < N; ++i) {
            EXPECT_FLOAT_EQ(got[static_cast<std::size_t>(i)],
                            static_cast<float>(i));
        }
    });

    producer.join();
    consumer.join();
    EXPECT_EQ(produced.load(), N);
    EXPECT_EQ(consumed.load(), N);
}

// ---------------- PoolAllocator ----------------

TEST(PoolAllocator, AcquireReusesAfterRelease) {
    PoolAllocator<int> pool(1);
    EXPECT_EQ(pool.size(), 1u);      // pre-warmed
    EXPECT_EQ(pool.free_count(), 1u);

    int* a = pool.acquire();
    EXPECT_NE(a, nullptr);
    EXPECT_EQ(pool.free_count(), 0u);
    *a = 42;

    pool.release(a);
    EXPECT_EQ(pool.free_count(), 1u);

    // Next acquire must reuse the same slot (only one slot exists).
    int* b = pool.acquire();
    EXPECT_EQ(b, a);
    EXPECT_EQ(*b, 42); // same memory, value preserved across recycle
    EXPECT_EQ(pool.free_count(), 0u);
}

TEST(PoolAllocator, GrowsBeyondReserve) {
    PoolAllocator<int> pool(2);
    int* p0 = pool.acquire();
    int* p1 = pool.acquire();
    int* p2 = pool.acquire(); // forces a new allocation past the warm-up
    EXPECT_NE(p0, nullptr);
    EXPECT_NE(p1, nullptr);
    EXPECT_NE(p2, nullptr);
    EXPECT_NE(p0, p1);
    EXPECT_NE(p1, p2);
    EXPECT_NE(p0, p2);
    EXPECT_EQ(pool.size(), 3u);

    pool.release(p0);
    pool.release(p1);
    pool.release(p2);
    EXPECT_EQ(pool.free_count(), 3u);
}

TEST(PoolAllocator, StableAddressAcrossGrowth) {
    // The motivating invariant: an outstanding pointer stays valid when the
    // pool grows (a std::vector<T> backing would invalidate it).
    PoolAllocator<int> pool(0);
    int* first = pool.acquire();
    *first = 7;
    // Acquire many more — if backing storage were a raw vector<int>, `first`
    // would dangle after reallocation.
    std::vector<int*> more;
    for (int i = 0; i < 64; ++i) more.push_back(pool.acquire());
    EXPECT_EQ(*first, 7); // still valid
    EXPECT_NE(first, more.back());
}

// ---------------- DspConfig JSON + normalization ----------------

TEST(DspConfig, FromJsonParsesAllFields) {
    DspConfig c;
    ASSERT_TRUE(from_json(
        R"({"sample_rate":48000,"block_size":2048,"fft_size":8192,)"
        R"("window_type":"hann","overlap":0.75,)"
        R"("spectrogram_min_freq":20,"spectrogram_max_freq":20000})",
        c));
    EXPECT_FLOAT_EQ(c.sample_rate, 48000.0f);
    EXPECT_EQ(c.block_size, 2048);
    EXPECT_EQ(c.fft_size, 8192);
    EXPECT_EQ(c.window_type, WindowType::Hann);
    EXPECT_FLOAT_EQ(c.overlap, 0.75f);
    EXPECT_FLOAT_EQ(c.spectrogram_min_freq, 20.0f);
    EXPECT_FLOAT_EQ(c.spectrogram_max_freq, 20000.0f);
}

TEST(DspConfig, FromJsonMissingFieldsKeepDefaults) {
    DspConfig c;
    ASSERT_TRUE(from_json(R"({"sample_rate":96000})", c));
    EXPECT_FLOAT_EQ(c.sample_rate, 96000.0f);
    EXPECT_EQ(c.block_size, 1024);      // default
    EXPECT_EQ(c.window_type, WindowType::Hann); // default
    EXPECT_FLOAT_EQ(c.overlap, 0.5f);   // default
}

TEST(DspConfig, FromJsonUnknownKeysIgnored) {
    DspConfig c;
    // Forward-compatible: UI can add fields older cores don't know about.
    ASSERT_TRUE(from_json(R"({"sample_rate":48000,"future_field":99})", c));
    EXPECT_FLOAT_EQ(c.sample_rate, 48000.0f);
}

TEST(DspConfig, FromJsonWindowTypeCaseInsensitive) {
    DspConfig c;
    ASSERT_TRUE(from_json(R"({"window_type":"BLACKMAN"})", c));
    EXPECT_EQ(c.window_type, WindowType::Blackman);
}

TEST(DspConfig, FromJsonUnknownWindowKeepsDefault) {
    DspConfig c;
    ASSERT_TRUE(from_json(R"({"window_type":"flattop"})", c));
    EXPECT_EQ(c.window_type, WindowType::Hann); // default retained
}

TEST(DspConfig, FromJsonMalformedReturnsFalse) {
    DspConfig c;
    EXPECT_FALSE(from_json("", c));
    EXPECT_FALSE(from_json("{", c));
    EXPECT_FALSE(from_json(R"({"sample_rate":})", c));
    EXPECT_FALSE(from_json(R"("not_an_object")", c));
}

TEST(DspConfig, ToJsonRoundTripsThroughFromJson) {
    DspConfig original;
    original.sample_rate = 48000.0f;
    original.block_size = 512;
    original.fft_size = 2048;
    original.window_type = WindowType::Blackman;
    original.overlap = 0.25f;
    original.spectrogram_min_freq = 30.0f;
    original.spectrogram_max_freq = 18000.0f;

    std::string json = to_json(original);
    DspConfig parsed;
    ASSERT_TRUE(from_json(json, parsed));
    EXPECT_FLOAT_EQ(parsed.sample_rate, original.sample_rate);
    EXPECT_EQ(parsed.block_size, original.block_size);
    EXPECT_EQ(parsed.fft_size, original.fft_size);
    EXPECT_EQ(parsed.window_type, original.window_type);
    EXPECT_FLOAT_EQ(parsed.overlap, original.overlap);
    EXPECT_FLOAT_EQ(parsed.spectrogram_min_freq, original.spectrogram_min_freq);
    EXPECT_FLOAT_EQ(parsed.spectrogram_max_freq, original.spectrogram_max_freq);
}

TEST(DspConfig, NormalizedClampsOverlap) {
    DspConfig c;
    c.overlap = -0.5f;
    EXPECT_FLOAT_EQ(c.normalized().overlap, 0.0f);
    c.overlap = 2.0f;
    EXPECT_FLOAT_EQ(c.normalized().overlap, 0.99f);
    c.overlap = 0.5f;
    EXPECT_FLOAT_EQ(c.normalized().overlap, 0.5f); // unchanged in-range
}

TEST(DspConfig, NormalizedRoundsFftToPow2) {
    DspConfig c;
    c.fft_size = 1000;
    EXPECT_EQ(c.normalized().fft_size, 1024);
    c.fft_size = 1;
    EXPECT_EQ(c.normalized().fft_size, 1);
    c.fft_size = 0;
    EXPECT_EQ(c.normalized().fft_size, 1);
    c.fft_size = 4097;
    EXPECT_EQ(c.normalized().fft_size, 8192);
}

TEST(DspConfig, NormalizedBoundsSpectrogramBandToNyquist) {
    DspConfig c;
    c.sample_rate = 48000.0f;
    c.spectrogram_min_freq = -100.0f;
    c.spectrogram_max_freq = 99999.0f;
    DspConfig n = c.normalized();
    EXPECT_FLOAT_EQ(n.spectrogram_min_freq, 0.0f);
    EXPECT_FLOAT_EQ(n.spectrogram_max_freq, 24000.0f); // nyquist
}

TEST(DspConfig, NormalizedSwapsInvertedBand) {
    DspConfig c;
    c.sample_rate = 48000.0f;
    c.spectrogram_min_freq = 5000.0f;
    c.spectrogram_max_freq = 1000.0f; // inverted
    DspConfig n = c.normalized();
    EXPECT_LE(n.spectrogram_min_freq, n.spectrogram_max_freq);
    EXPECT_FLOAT_EQ(n.spectrogram_min_freq, 1000.0f);
    EXPECT_FLOAT_EQ(n.spectrogram_max_freq, 5000.0f);
}

TEST(DspConfig, ParseWindowTypeRoundTrip) {
    for (WindowType wt : {WindowType::Rectangular, WindowType::Hann,
                          WindowType::Hamming, WindowType::Blackman}) {
        std::string name = audioscope::common::window_type_name(wt);
        WindowType back;
        ASSERT_TRUE(audioscope::common::parse_window_type(name, back));
        EXPECT_EQ(back, wt);
    }
    WindowType ignored;
    EXPECT_FALSE(audioscope::common::parse_window_type("nope", ignored));
}

// ---------------- Sample-format conversion ----------------

TEST(SampleFormat, SizeMatchesExpectations) {
    EXPECT_EQ(audioscope::common::sample_format_size(SampleFormat::S16), 2u);
    EXPECT_EQ(audioscope::common::sample_format_size(SampleFormat::S32), 4u);
    EXPECT_EQ(audioscope::common::sample_format_size(SampleFormat::F32), 4u);
}

TEST(SampleFormat, ConvertsS16ToF32) {
    std::int16_t src[] = {0, 32767, -32768, 16384};
    float dst[4] = {0};
    EXPECT_EQ(audioscope::common::convert_samples_to_f32(SampleFormat::S16, src, dst, 4), 4u);
    EXPECT_NEAR(dst[0], 0.0f, 1e-4f);
    EXPECT_NEAR(dst[1], 1.0f, 1e-3f);   // 32767/32768 ≈ 0.99997
    EXPECT_FLOAT_EQ(dst[2], -1.0f);    // -32768/32768 = -1.0 exactly
    EXPECT_NEAR(dst[3], 0.5f, 1e-3f);  // 16384/32768 = 0.5
}

TEST(SampleFormat, ConvertsS32ToF32) {
    std::int32_t src[] = {0, 2147483647, -2147483648};
    float dst[3] = {0};
    EXPECT_EQ(audioscope::common::convert_samples_to_f32(SampleFormat::S32, src, dst, 3), 3u);
    EXPECT_NEAR(dst[0], 0.0f, 1e-4f);
    EXPECT_NEAR(dst[1], 1.0f, 1e-2f);   // within float precision near full scale
    EXPECT_FLOAT_EQ(dst[2], -1.0f);
}

TEST(SampleFormat, CopiesF32Verbatim) {
    float src[] = {0.0f, 0.5f, -0.25f, 1.0f};
    float dst[4] = {0};
    EXPECT_EQ(audioscope::common::convert_samples_to_f32(SampleFormat::F32, src, dst, 4), 4u);
    for (int i = 0; i < 4; ++i) {
        EXPECT_FLOAT_EQ(dst[i], src[i]);
    }
}

TEST(SampleFormat, NullInputsAreNoOp) {
    EXPECT_EQ(audioscope::common::convert_samples_to_f32(SampleFormat::S16, nullptr, nullptr, 4), 0u);
}
