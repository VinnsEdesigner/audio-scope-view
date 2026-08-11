// generator.h — signal generator (PWM/LEDC output) on the ESP32-S3.
//
// Drives the ESP32 LEDC peripheral as a programmable square/sine/triangle/
// sawtooth/DC source. For square waves LEDC PWM is used directly (hardware,
// up to ~5 MHz); for arbitrary waveforms a DDS table is output via LEDC's
// duty-cycle updates from a high-priority task (software DDS, bandwidth-limited
// to a few hundred kHz). This is the scope's signal-generator output path —
// the analog complement to the ADC capture path.

#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "usb_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

// Initialize the generator on the given GPIO (LEDC channel/timer allocated).
void generator_init(int gpio);

// Configure + start the generator. Returns false on an unsupported combo
// (e.g. sine above the DDS limit).
bool generator_start(as_usb_waveform wave, uint64_t freq_hz,
                     uint32_t amp_mv, int32_t offset_mv,
                     uint32_t duty_permille);

// Stop the generator (output goes to 0 V / high-Z).
void generator_stop(void);

// True while the generator is running.
bool generator_is_running(void);

// Hardware limits reported to the host via GET_BANDWIDTH.
#define AS_USB_GEN_MAX_FREQ_HZ       5000000u   // LEDC hardware PWM ceiling
#define AS_USB_GEN_RESOLUTION_BITS   12u        // LEDC duty resolution

#ifdef __cplusplus
}
#endif
