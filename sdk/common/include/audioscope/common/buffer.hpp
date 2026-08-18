#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <memory>
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
    /// Producer side only. Blocks (returns early) once the ring is full.
    std::size_t push(const float* src, std::size_t count) {
        std::size_t pushed = 0;
        while (pushed < count) {
            const std::size_t w = write_pos_.load(std::memory_order_relaxed);
            const std::size_t r = read_pos_.load(std::memory_order_acquire);
            // Count is w - r (monotonic indices, never wrapped). Full when the
            // count reaches capacity. Using `(w - r) % capacity_` here would make
            // a full ring indistinguishable from an empty one.
            if (w - r >= capacity_) break;
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
            if (r == w) break; // empty
            dst[drained++] = buffer_[r % capacity_];
            read_pos_.fetch_add(1, std::memory_order_release);
        }
        return drained;
    }

    /// Approximate number of samples currently buffered.
    std::size_t available() const {
        const std::size_t w = write_pos_.load(std::memory_order_acquire);
        const std::size_t r = read_pos_.load(std::memory_order_acquire);
        return w - r;
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

/// Free-list object pool for the capture → DSP hot path. Hands out reusable
/// `T` instances so the per-frame allocation that would otherwise happen on a
/// real-time thread (and risk GC/fragmentation on hosts that have it) is
/// avoided.
///
/// Backing storage is `std::vector<std::unique_ptr<T>>` so each slot's address
/// is stable for the pool's lifetime — `emplace_back` never invalidates an
/// outstanding pointer. The free list is a lock-free Treiber stack of raw
/// pointers into those stable slots; once warm, `acquire`/`release` touch no
/// heap. `T` must be default-constructible.
template <typename T>
class PoolAllocator {
public:
    explicit PoolAllocator(std::size_t reserve = 0) {
        owned_.reserve(reserve);
        for (std::size_t i = 0; i < reserve; ++i) {
            owned_.push_back(std::make_unique<T>());
            free_list_.push(owned_.back().get());
        }
    }

    /// Acquire an instance. Reuses a freed one when available, otherwise
    /// constructs a new one (one stable-slot allocation; never grows again
    /// once the high-water mark is reached). Never returns null.
    T* acquire() {
        T* p = free_list_.pop();
        if (p != nullptr) return p;
        owned_.push_back(std::make_unique<T>());
        return owned_.back().get();
    }

    /// Return an instance to the pool. Passing null or a pointer not from this
    /// pool is undefined behavior.
    void release(T* p) {
        if (p != nullptr) free_list_.push(p);
    }

    std::size_t size() const { return owned_.size(); }
    std::size_t free_count() const { return free_list_.size(); }

private:
    // Lock-free Treiber stack of pointers into `owned_`. `owned_` owns the
    // memory (unique_ptr, stable address); the free list only reorders access
    // to it, so ABA is benign here (a recycled slot is a recycled slot
    // regardless of how many times it cycled).
    class FreeList {
    public:
        void push(T* p) {
            Node* n = new Node{p, head_.load(std::memory_order_relaxed)};
            while (!head_.compare_exchange_weak(n->next, n,
                                                std::memory_order_release,
                                                std::memory_order_relaxed)) {
                // retry; n->next refreshed by compare_exchange_weak
            }
        }

        T* pop() {
            Node* n = head_.load(std::memory_order_acquire);
            while (n != nullptr &&
                   !head_.compare_exchange_weak(n, n->next,
                                                std::memory_order_acquire,
                                                std::memory_order_relaxed)) {
                // retry; n refreshed by compare_exchange_weak
            }
            if (n == nullptr) return nullptr;
            T* p = n->value;
            delete n;
            return p;
        }

        std::size_t size() const {
            std::size_t count = 0;
            for (Node* n = head_.load(std::memory_order_acquire); n != nullptr;
                 n = n->next) {
                ++count;
            }
            return count;
        }

    private:
        struct Node {
            T* value;
            Node* next;
        };
        std::atomic<Node*> head_{nullptr};
    };

    std::vector<std::unique_ptr<T>> owned_;
    FreeList free_list_;
};

} // namespace common
} // namespace audioscope
