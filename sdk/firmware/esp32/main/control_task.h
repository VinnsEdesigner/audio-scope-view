// control_task.h — host→device command dispatcher.

#pragma once

#include <stdbool.h>
#include "ring_buffer.h"

#ifdef __cplusplus
extern "C" {
#endif

void control_task_start(ring_buffer_t* rb);

// True when the host has sent START_STREAM and not yet STOP_STREAM. The
// stream task gates its DMA-read/pump loop on this flag.
bool control_is_streaming(void);

#ifdef __cplusplus
}
#endif
