// stream_task.h — DMA-read codec -> ring -> USB bulk-IN.

#pragma once

#include "ring_buffer.h"

#ifdef __cplusplus
extern "C" {
#endif

void stream_task_start(ring_buffer_t* rb);

#ifdef __cplusplus
}
#endif
