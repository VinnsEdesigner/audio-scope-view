#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

namespace audioscope {
namespace common {

/// Lock-free single-producer single-consumer ring buffer of floats.
/// Used to bridge platform audio capture threads and the DSP processing thread.
class AudioRingBuffer {
public:
    explicit AudioRingBuffer(std::size_t capacity)
        : buffer_(capacity == 0 ? 1 : capacity)
        , capacity_(capacity == 0 ? 1 : capacity) {}

    std::size_t capacity() const { return capacity_; }

    /// Push up to `count` samples. Returns the number actually pushed.
    /// Producer side only.
    std::size_t push(const float* src, std::size_t count) {
        std::size_t pushed = 0;
        while (pushed < count) {
            const std::size_t w = write_pos_.load(std::memory_order_relaxed);
            const std::size_t r = read_pos_.load(std::memory_order_acquire);
            const std::size_t free_slots = capacity_ - ((w - r) % capacity_);
            if (free_slots == 0) break;
            buffer_[w % capacity_] = src[pushed++];
            write_pos_.fetch_add(1, std::memory_order_release);
        }
        return pushed;
    }

    /// Drain up to `count` samples into `dst`. Returns the number drained.
    /// Consumer side only.
    std::size_t drain(float* dst, std::size_t count) {
        std::size_t drained = 0;
        while (drained < count) {
            const std::size_t r = read_pos_.load(std::memory_order_relaxed);
            const std::size_t w = write_pos_.load(std::memory_order_acquire);
            if (r == w) break;
            dst[drained++] = buffer_[r % capacity_];
            read_pos_.fetch_add(1, std::memory_order_release);
        }
        return drained;
    }

    /// Approximate number of samples currently buffered.
    std::size_t available() const {
        const std::size_t w = write_pos_.load(std::memory_order_acquire);
        const std::size_t r = read_pos_.load(std::memory_order_acquire);
        return (w - r) % capacity_;
    }

    void clear() {
        read_pos_.store(write_pos_.load(std::memory_order_relaxed),
                        std::memory_order_release);
    }

private:
    std::vector<float> buffer_;
    const std::size_t capacity_;
    // Monotonically increasing indices; modulo applied on access.
    // Using unsigned 64-bit so wraparound is well-defined and never
    // happens in practice.
    alignas(64) std::atomic<std::uint64_t> write_pos_{0};
    alignas(64) std::atomic<std::uint64_t> read_pos_{0};
};

} // namespace common
} // namespace audioscope
