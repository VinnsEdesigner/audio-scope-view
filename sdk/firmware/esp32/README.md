# audioscope ESP32 firmware

ESP32-S3 firmware that presents a **custom vendor-class USB device** (NOT UAC).
The host talks to the processor directly via libusb — see
`docs/ESP32_USB_PROTOCOL.md` for the wire protocol and
`sdk/bindings/usb/` for the host `AudioBinding`.

## Hardware

- **MCU:** ESP32-S3 (native USB OTG). Other ESP32 variants without native USB
  need a USB-serial bridge and are not supported by this binding.
- **Codec (mandatory):** the on-chip ADC is too low-rate/noisy for scope use.
  Wire an external I2S ADC. Default: **PCM1802** (24-bit). Also supported:
  UDA1334A, WM8731 — set `AUDIOSCOPE_CODEC_ID` in `board_config.h`.
- **Analog front-end:** accurate scope readings need an external input stage
  (protection, scaling, anti-alias) before the codec. See ARCHITECTURE.md
  "Analog caveat".

## Pin map (`board_config.h`)

```
GPIO 4  -> I2S BCLK
GPIO 5  -> I2S LRCK (WS)
GPIO 6 <-  I2S DOUT (codec ADC data IN)
MCLK     not used (codec self-clock) — set AUDIOSCOPE_I2S_MCLK to -1
```

## Build & flash (needs ESP-IDF v5.x)

```bash
export IDF_PATH=/path/to/esp-idf
. $IDF_PATH/export.sh
cd sdk/firmware/esp32
idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

On a host without ESP-IDF (e.g. CI), the firmware C sources are syntax-checked
with stub `tusb.h` / `esp_*` headers — `gcc -std=c11 -fsyntax-only` — the same
pattern used for the Android NDK and WASAPI sources. The authoritative build is
`idf.py build` above.

## Verification in this sandbox

- `usb_protocol.c` compiles clean with **no** stubs (pure C99).
- `main.c`, `usb_descriptors.c`, `usb_device.c`, `codec.c`, `stream_task.c`,
  `control_task.c` pass `gcc -std=c11 -fsyntax-only` with stub ESP-IDF headers.
- The host side (`sdk/bindings/usb/usb_binding.cpp` + `test_usb_binding.cpp`)
  builds and tests **for real** here (libusb-1.0 is installable) — see
  `sdk/bindings/usb/README.md`.

## Files

| File | Purpose |
|---|---|
| `CMakeLists.txt` | top-level ESP-IDF project (OPTIONAL include so it browses without IDF) |
| `partitions.csv` | flash partition table |
| `sdkconfig.defaults` | Kconfig defaults (USB OTG, TinyUSB vendor class, I2S, PSRAM) |
| `idf_component.yml` | component manifest |
| `main/main.c` | `app_main`: init USB → codec → ring → control/stream tasks |
| `main/usb_descriptors.c` | TinyUSB device + config descriptors (vendor class, 2 bulk EPs) |
| `main/usb_device.c` | TinyUSB vendor-class callbacks (EP0 control + bulk IN/OUT) |
| `main/codec.c/.h` | I2S codec driver (PCM1802 default; UDA1334A/WM8731 swap-point) |
| `main/ring_buffer.c/.h` | FreeRTOS ring between DMA-read and USB bulk-IN tasks |
| `main/stream_task.c/.h` | codec → ring → bulk-IN pump |
| `main/control_task.c/.h` | host command dispatcher (start/stop/set_rate/...) |
| `main/board_config.h` | pin map + USB endpoint config |
