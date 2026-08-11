// ring_buffer.c / ring_buffer.h — FreeRTOS ring between the I2S-DMA read
// task (producer) and the USB bulk-IN task (consumer). Single-producer,
// single-consumer; the USB task drains on its own cadence.
//
// Pure C99 — no ESP-isms in the data structure itself (uses esp_* only for
// the allocation + the mutex type). Compiles on the host for unit testing.

#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ring_buffer ring_buffer_t;

ring_buffer_t* ring_buffer_create(size_t capacity_frames);
void           ring_buffer_destroy(ring_buffer_t* rb);
size_t         ring_buffer_write(ring_buffer_t* rb, const void* src, size_t frames);
size_t         ring_buffer_read(ring_buffer_t* rb, void* dst, size_t frames);
size_t         ring_buffer_available(const ring_buffer_t* rb);

#ifdef __cplusplus
}
#endif
