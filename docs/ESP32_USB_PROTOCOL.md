# audioscope bare-USB protocol (ESP32 ↔ host)

This is the authoritative spec for the wire protocol between the ESP32
firmware (`sdk/firmware/esp32`) and the host `AudioBinding`
(`sdk/bindings/usb/usb_binding.cpp`). Both sides include
`sdk/bindings/usb/usb_protocol.h`, which is the **single source of truth** —
a struct-size drift is a compile error (see the `AS_USB_STATIC_ASSERT` guards
and the `UsbProtocol.*Is*Bytes` GoogleTest cases).

> **Design decision (overrides ARCHITECTURE.md's earlier UAC strategy):** the
> ESP32 presents a **custom vendor-class USB device**, NOT a USB Audio Class
> device. The host talks to the processor directly via libusb, bypassing the
> OS audio stack (ALSA / WASAPI / CoreAudio / Oboe). Rationale: direct
> processor communication, a real control surface (gain / sample rate /
> channels) that UAC does not expose, lower latency, and no OS-level audio
> processing/AGC. Tradeoff: the device is no longer plug-and-play with
> arbitrary DAWs/recorders — it requires the audioscope host (or any libusb
> client) to read it.

## Device identity

| Field | Value |
|---|---|
| Vendor ID  | `0x1209` (pid.codes community) — override with `-DAUDIOSCOPE_USB_VID=` |
| Product ID | `0xA500` — override with `-DAUDIOSCOPE_USB_PID=` |
| USB class  | `0xFF` (vendor-specific) |
| USB version | 2.0 |

## Endpoints

| Endpoint | Direction | Use |
|---|---|---|
| EP0 control | bidirectional | control channel: host sends 16-byte command headers; device returns 16-byte response headers (+ optional payload) |
| `0x81` bulk IN | device → host | sample stream, framed with `as_usb_stream_header` |
| `0x01` bulk OUT | host → device | (optional) commands that don't fit EP0 |

## Control channel

### Command header (16 bytes, little-endian)

```
offset  field         type     notes
 0      magic[2]      u8[2]    {0x41, 0x53}  ('A','S')
 2      cmd           u8       as_usb_command
 3      _reserved     u8       0
 4      payload_len   u32      bytes of payload following the header
 8      seq           u32      monotonic, host increments per request
12      crc           u16      CRC-16/CCITT (poly 0x1021, init 0xFFFF) over bytes 0..11
14      _pad          u16      0
```

### Commands

| Opcode | Name            | Payload (host→device)            | Response payload |
|---|---|---|---|
| 0x01 | `GET_INFO`     | none                             | `as_usb_device_info` (64 bytes) |
| 0x02 | `START_STREAM` | none                             | none |
| 0x03 | `STOP_STREAM`  | none                             | none |
| 0x04 | `SET_RATE`     | `as_usb_cmd_set_rate` (4 B)      | none |
| 0x05 | `SET_GAIN`     | `as_usb_cmd_set_gain` (4 B)      | none |
| 0x06 | `SET_CHANNELS` | `as_usb_cmd_set_channels` (4 B)   | none |
| 0x07 | `GET_STATUS`   | none                             | (future) status struct |

### Response header (16 bytes)

```
 0  magic[2]     u8[2]   {0x41, 0x53}
 2  status       u8      as_usb_status (0x00 = OK)
 3  cmd_echo     u8      the command this responds to
 4  payload_len  u32
 8  seq          u32     echoes the request seq
12  crc          u16
14  _pad         u16
```

### Status codes

`0x00 OK · 0x01 ERR · 0x02 ERR_CMD · 0x03 ERR_FMT · 0x04 ERR_BUSY · 0x05 ERR_CRC`

## Stream channel (bulk IN)

Each transfer begins with a 4-byte frame header followed by `sample_count`
sample frames:

```
 0  magic         u16   0x5341 ('AS' little-endian — distinct from control magic)
 2  sample_count  u16   number of sample FRAMES (not bytes) following
 4  ...           ...   sample_count * frame_size bytes, interleaved
```

`frame_size = channels × bytes_per_sample` (reported in `GET_INFO.frame_size`).

## Sample formats

| `as_usb_sample_format` | Value | Width |
|---|---|---|
| `AS_USB_FMT_F32` | 0 | float32 (canonical DSP format) |
| `AS_USB_FMT_S16` | 1 | signed 16-bit PCM |
| `AS_USB_FMT_S24` | 2 | 24-bit PCM, left-justified in a 32-bit word |
| `AS_USB_FMT_S32` | 3 | signed 32-bit PCM |

The host normalizes any native PCM to float32 via
`audioscope::common::convert_samples_to_f32`, so the DSP core always sees the
canonical format regardless of the device's native width.

## GET_INFO response (`as_usb_device_info`, 64 bytes)

```
 0  hw_version      u32
 4  fw_version      u32
 8  codec_id        u32    0=UDA1334A 1=PCM1802 2=WM8731
12  max_sample_rate u32    Hz
16  min_sample_rate u32    Hz
20  channels        u32    current channel count
24  sample_format   u32    current as_usb_sample_format
28  gain_steps      u32    discrete gain values (0 = no gain control)
32  gain_min        u32    inclusive
36  gain_max        u32    inclusive
40  frame_size      u32    bytes per sample frame
44  name[16]        u8[16] null-terminated device name
60  _reserved[4]    u8[4]  pad to 64
```

## CRC

`as_usb_crc16(data, len)` — CRC-16/CCITT, polynomial `0x1021`, init `0xFFFF`.
The same function is linked by firmware and host (see
`sdk/bindings/usb/usb_protocol.c`) so the two sides can never diverge. Known
vector: `crc16("123456789") == 0x29B1` (asserted in `test_usb_binding.cpp`).
