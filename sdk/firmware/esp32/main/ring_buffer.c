// ring_buffer.c — see ring_buffer.h. Frame ring for the ESP32 firmware.

#include "ring_buffer.h"

#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

struct ring_buffer {
    uint8_t* buf;
    size_t   frame_bytes;   // bytes per frame (channels * bytes/sample)
    size_t   cap;           // capacity in FRAMES
    size_t   head;          // next write frame
    size_t   tail;          // next read frame
    size_t   count;         // frames currently held
    SemaphoreHandle_t mu;
};

ring_buffer_t* ring_buffer_create(size_t capacity_frames) {
    // Default frame size: 4 bytes (24-bit-in-32 / 32-bit / float). The codec
    // sets the real frame size at init; this is a safe default.
    const size_t frame_bytes = 4;
    ring_buffer_t* rb = calloc(1, sizeof(*rb));
    if (!rb) return NULL;
    rb->buf = calloc(capacity_frames, frame_bytes);
    if (!rb->buf) { free(rb); return NULL; }
    rb->frame_bytes = frame_bytes;
    rb->cap = capacity_frames;
    rb->mu = xSemaphoreCreateMutex();
    if (!rb->mu) { free(rb->buf); free(rb); return NULL; }
    return rb;
}

void ring_buffer_destroy(ring_buffer_t* rb) {
    if (!rb) return;
    if (rb->mu) vSemaphoreDelete(rb->mu);
    free(rb->buf);
    free(rb);
}

size_t ring_buffer_write(ring_buffer_t* rb, const void* src, size_t frames) {
    if (!rb || !src || frames == 0) return 0;
    xSemaphoreTake(rb->mu, portMAX_DELAY);
    size_t free = rb->cap - rb->count;
    size_t take = frames < free ? frames : free;  // drop overflow
    for (size_t i = 0; i < take; ++i) {
        memcpy(rb->buf + ((rb->head + i) % rb->cap) * rb->frame_bytes,
               (const uint8_t*)src + i * rb->frame_bytes, rb->frame_bytes);
    }
    rb->head = (rb->head + take) % rb->cap;
    rb->count += take;
    xSemaphoreGive(rb->mu);
    return take;
}

size_t ring_buffer_read(ring_buffer_t* rb, void* dst, size_t frames) {
    if (!rb || !dst || frames == 0) return 0;
    xSemaphoreTake(rb->mu, portMAX_DELAY);
    size_t take = frames < rb->count ? frames : rb->count;
    for (size_t i = 0; i < take; ++i) {
        memcpy((uint8_t*)dst + i * rb->frame_bytes,
               rb->buf + ((rb->tail + i) % rb->cap) * rb->frame_bytes, rb->frame_bytes);
    }
    rb->tail = (rb->tail + take) % rb->cap;
    rb->count -= take;
    xSemaphoreGive(rb->mu);
    return take;
}

size_t ring_buffer_available(const ring_buffer_t* rb) {
    if (!rb) return 0;
    return rb->count;
}
