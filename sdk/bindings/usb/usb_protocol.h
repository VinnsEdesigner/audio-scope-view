// usb_protocol.h — the audioscope bare-USB wire protocol (shared contract).

// (sdk/bindings/usb/usb_binding.cpp). Both sides include this header so a
// drift is a compile error. Keep it pure C99 (no C++/ESP-isms) so it
// compiles under the ESP-IDF C toolchain AND the host g++/clang.
//bypassing the OS audio stack.
//   - Control channel: EP0 vendor requests + a bulk-OUT endpoint for
//     host→device commands (START/STOP/SET_RATE/...).
//   - Stream channel:   bulk-IN endpoint, device→host sample frames.
//   - All multi-byte fields are LITTLE-ENDIAN (the ESP32 is LE; every
//     desktop host libusb runs on is LE too — no byte-swap needed).

#ifndef AUDIOSCOPE_USB_PROTOCOL_H
#define AUDIOSCOPE_USB_PROTOCOL_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ------------------------------------------------------------------ */
/* Device identity                                                     */
/* ------------------------------------------------------------------ */

// Custom Vendor ID / Product ID. 0x1209 is the pid.codes community VID
// (open hardware); the PID 0xA500 is reserved here for the audioscope UAC
// device. Override at build time via -D if you provision your own VID.
#ifndef AUDIOSCOPE_USB_VID
#define AUDIOSCOPE_USB_VID 0x1209
#endif
#ifndef AUDIOSCOPE_USB_PID
#define AUDIOSCOPE_USB_PID 0xA500
#endif

// USB endpoint addresses. Bulk OUT (host->device commands) and bulk IN
// (device->host sample stream). Single interface, vendor-specific class.
// EP sizes: 512B for high-speed, capped automatically by TinyUSB.
#ifndef AUDIOSCOPE_USB_EP_OUT
#define AUDIOSCOPE_USB_EP_OUT 0x01
#endif
#ifndef AUDIOSCOPE_USB_EP_IN
#define AUDIOSCOPE_USB_EP_IN  0x81
#endif
#ifndef AUDIOSCOPE_USB_EP_SIZE
#define AUDIOSCOPE_USB_EP_SIZE 512
#endif

#define AUDIOSCOPE_USB_MAGIC0 0x41  /* 'A' */
#define AUDIOSCOPE_USB_MAGIC1 0x53  /* 'S' */

/* ------------------------------------------------------------------ */
/* Sample format (matches audioscope::common::SampleFormat ordering)  */
/* ------------------------------------------------------------------ */

typedef enum {
    AS_USB_FMT_F32 = 0,  
    AS_USB_FMT_S16 = 1,  
    AS_USB_FMT_S24 = 2,  
    AS_USB_FMT_S32 = 3,  
} as_usb_sample_format;

/* ------------------------------------------------------------------ */
/* Control packet (host → device, over bulk-OUT or EP0 vendor req)    */
/* ------------------------------------------------------------------ */

typedef enum {
    // --- acquisition (the scope input path) ---
    AS_USB_CMD_GET_INFO     = 0x01,  // request device capabilities
    AS_USB_CMD_START_STREAM = 0x02,  // begin sending sample frames on bulk-IN
    AS_USB_CMD_STOP_STREAM  = 0x03,  // stop the sample stream
    AS_USB_CMD_SET_RATE     = 0x04,  // set sample rate (Hz)
    AS_USB_CMD_SET_GAIN     = 0x05,  // set analog input gain (codec-dependent)
    AS_USB_CMD_SET_CHANNELS = 0x06,  // set channel count (1 = mono)
    AS_USB_CMD_GET_STATUS   = 0x07,  // request current stream status

    // --- scope configuration (timebase / trigger / vertical / coupling) ---
    AS_USB_CMD_GET_BANDWIDTH = 0x08, // query the ADC's real max rate + analog BW
    AS_USB_CMD_SET_TIMEBASE  = 0x09, // set time per division (ns/div)
    AS_USB_CMD_SET_TRIGGER   = 0x0A, // edge/level/source trigger config
    AS_USB_CMD_SET_VSCALE    = 0x0B, // set volts per division (mV/div)
    AS_USB_CMD_SET_COUPLING  = 0x0C, // AC/DC/

    // --- signal generator (PWM / DDS output path) ---
    AS_USB_CMD_GEN_START     = 0x10, // start the waveform generator
    AS_USB_CMD_GEN_STOP      = 0x11, // stop the generator
    AS_USB_CMD_GEN_SET_FREQ  = 0x12, // set output frequency (Hz, 64-bit)
    AS_USB_CMD_GEN_SET_AMP   = 0x13, // set output amplitude (mV p-p)
    AS_USB_CMD_GEN_SET_OFFSET= 0x14, // set DC offset (mV)
    AS_USB_CMD_GEN_SET_WAVE  = 0x15, // set waveform (sine/square/tri/saw/dc)
    AS_USB_CMD_GEN_SET_DUTY  = 0x16, // set duty cycle (per-mille, for square)
} as_usb_command;

// Fixed-size command header (16 bytes). Payload (if any) follows.
typedef struct {
    uint8_t  magic[2];     // {AUDIOSCOPE_USB_MAGIC0, AUDIOSCOPE_USB_MAGIC1}
    uint8_t  cmd;          // as_usb_command
    uint8_t  _reserved;    // align to 4
    uint32_t payload_len;  // bytes of payload following this header
    uint32_t seq;          // monotonic, host increments per request
    uint16_t crc;          // CRC-16/CCITT over (magic..seq), payload NOT included
    uint16_t _pad;         // keep 16 bytes
} as_usb_cmd_header;

// SET_RATE payload (4 bytes)
typedef struct {
    uint32_t sample_rate;  // Hz, e.g. 48000
} as_usb_cmd_set_rate;

// SET_GAIN payload (4 bytes) — gain index, codec-dependent (see GET_INFO)
typedef struct {
    uint32_t gain_index;
} as_usb_cmd_set_gain;

// SET_CHANNELS payload (4 bytes)
typedef struct {
    uint32_t channels;     // 1 = mono (the DSP core is mono-focused)
} as_usb_cmd_set_channels;

// SET_TIMEBASE payload (4 bytes) — time per division, nanoseconds.
typedef struct {
    uint32_t ns_per_div;   // e.g. 1000 = 1 µs/div
} as_usb_cmd_set_timebase;

// SET_TRIGGER payload (8 bytes) — edge + level + source + holdoff.
typedef struct {
    uint8_t  edge;         // 0=rising 1=falling 2=both
    uint8_t  source;       // 0=ch0
    uint16_t level_milli;  // trigger level in millivolts (signed via int16 cast)
    uint32_t holdoff_us;   // trigger holdoff in microseconds
} as_usb_cmd_set_trigger;

// SET_VSCALE payload (4 bytes) — volts per division, millivolts.
typedef struct {
    uint32_t mv_per_div;   // e.g. 500 = 0.5 V/div
} as_usb_cmd_set_vscale;

// SET_COUPLING payload (4 bytes).
typedef enum {
    AS_USB_COUPLING_DC = 0,
    AS_USB_COUPLING_AC = 1,
    AS_USB_COUPLING_GND = 2,
} as_usb_coupling;
typedef struct {
    uint32_t coupling;     // as_usb_coupling
} as_usb_cmd_set_coupling;

// --- signal generator payloads ---
typedef enum {
    AS_USB_WAVE_SINE   = 0,
    AS_USB_WAVE_SQUARE = 1,
    AS_USB_WAVE_TRI    = 2,
    AS_USB_WAVE_SAW    = 3,
    AS_USB_WAVE_DC     = 4,
} as_usb_waveform;

typedef struct {
    uint64_t freq_hz;      // output frequency (Hz)
} as_usb_cmd_gen_set_freq;

typedef struct {
    uint32_t amp_mv;       // peak-to-peak amplitude (mV)
} as_usb_cmd_gen_set_amp;

typedef struct {
    int32_t  offset_mv;    // DC offset (mV, signed)
} as_usb_cmd_gen_set_offset;

typedef struct {
    uint32_t waveform;     // as_usb_waveform
} as_usb_cmd_gen_set_wave;

typedef struct {
    uint32_t duty_permille; // 0..1000 (square wave duty cycle)
} as_usb_cmd_gen_set_duty;

/* ------------------------------------------------------------------ */
/* Response packet (device → host)                                     */
/* ------------------------------------------------------------------ */

// Fixed-size response header (16 bytes). Payload follows when payload_len > 0.
typedef struct {
    uint8_t  magic[2];
    uint8_t  status;       // as_usb_status
    uint8_t  cmd_echo;     // the command this responds to
    uint32_t payload_len;
    uint32_t seq;          // echoes the request seq
    uint16_t crc;
    uint16_t _pad;
} as_usb_rsp_header;

typedef enum {
    AS_USB_STATUS_OK         = 0x00,
    AS_USB_STATUS_ERR        = 0x01,  // generic
    AS_USB_STATUS_ERR_CMD    = 0x02,  // unknown command
    AS_USB_STATUS_ERR_FMT    = 0x03,  // unsupported sample format/rate
    AS_USB_STATUS_ERR_BUSY   = 0x04,  // stream already running / device busy
    AS_USB_STATUS_ERR_CRC    = 0x05,  // command CRC mismatch
} as_usb_status;

// GET_INFO response payload (64 bytes). Describes the device's capabilities.
// Padding keeps the struct a fixed size so future fields can be added without
// breaking older hosts (they read only the fields they know).
typedef struct {
    uint32_t hw_version;        // firmware/hardware revision
    uint32_t fw_version;
    uint32_t codec_id;          // 0=UDA1334A 1=PCM1802 2=WM8731 (see as_usb_codec)
    uint32_t max_sample_rate;   // Hz
    uint32_t min_sample_rate;
    uint32_t channels;         // current channel count
    uint32_t sample_format;    // current as_usb_sample_format
    uint32_t gain_steps;       // number of discrete gain values (0 = no gain ctrl)
    uint32_t gain_min;          // gain index bounds (inclusive)
    uint32_t gain_max;
    uint32_t frame_size;       // bytes per sample frame (channels * bytes/sample)
    uint8_t  name[16];         // null-terminated human-readable device name
    uint8_t  _reserved[4];     // pad to 64
} as_usb_device_info;

// External codec identifiers (sent in as_usb_device_info::codec_id).
#define AS_USB_CODEC_UDA1334A 0u
#define AS_USB_CODEC_PCM1802  1u
#define AS_USB_CODEC_WM8731   2u

// GET_BANDWIDTH response payload (32 bytes) — the ADC's REAL analog + digital
// limits, so the host can present truthful scope ranges (not just the
// configured sample rate). Queried at device open.
typedef struct {
    uint32_t adc_max_rate;     // hard max sample rate the codec can clock (Hz)
    uint32_t analog_bw_hz;     // -3 dB analog input bandwidth (Hz)
    uint32_t effective_bw_hz;  // min(adc_max_rate/2, analog_bw_hz) — usable BW
    uint32_t resolution_bits;  // ADC resolution (e.g. 24 for PCM1802)
    uint32_t vrange_mv;        // full-scale input range, mV p-p (e.g. 3200)
    uint32_t noise_uv;         // input-referred noise, µV (typical)
    uint32_t gen_max_freq_hz;  // waveform generator max frequency (PWM/DAC)
    uint32_t gen_resolution_bits; // generator amplitude resolution (bits)
} as_usb_bandwidth_info;

/* ------------------------------------------------------------------ */
/* Stream framing (bulk-IN)                                            */
/* ------------------------------------------------------------------ */

// Sample frames stream over bulk-IN as: a 4-byte frame header + N samples.
// The host reads whole frames; partial frames are an error.
//
//   [uint16_t magic=0x5341][uint16_t sample_count][sample_count * frame_size bytes]
//
// (magic 0x5341 = 'AS' little-endian, distinct from the control magic so a
// host can re-sync after a dropped USB transfer.)

#define AS_USB_STREAM_MAGIC 0x5341u

typedef struct {
    uint16_t magic;         // AS_USB_STREAM_MAGIC
    uint16_t sample_count;  // number of sample FRAMES in this packet
    // followed by sample_count * frame_size bytes of interleaved samples
} as_usb_stream_header;

/* ------------------------------------------------------------------ */
/* CRC-16/CCITT (poly 0x1021, init 0xFFFF) — reference implementation   */
/* ------------------------------------------------------------------ */

// Pure, side-effect-free: both firmware and host link the SAME function so
// the CRC never diverges. Declared here so a host test can assert against
// known vectors.
uint16_t as_usb_crc16(const uint8_t* data, size_t len);

/* ------------------------------------------------------------------ */
/* Compile-time ABI guards (host test asserts these too)              */
/* ------------------------------------------------------------------ */

// Catch a struct-size drift between firmware and host at link time.
#define AS_USB_STATIC_ASSERT(cond, name) \
    typedef char as_usb_static_assert_##name[(cond) ? 1 : -1]

AS_USB_STATIC_ASSERT(sizeof(as_usb_cmd_header) == 16, cmd_header_16);
AS_USB_STATIC_ASSERT(sizeof(as_usb_rsp_header) == 16, rsp_header_16);
AS_USB_STATIC_ASSERT(sizeof(as_usb_device_info) == 64, device_info_64);
AS_USB_STATIC_ASSERT(sizeof(as_usb_bandwidth_info) == 32, bandwidth_info_32);
AS_USB_STATIC_ASSERT(sizeof(as_usb_stream_header) == 4, stream_header_4);

#ifdef __cplusplus
} // extern "C"
#endif

#endif // AUDIOSCOPE_USB_PROTOCOL_H
