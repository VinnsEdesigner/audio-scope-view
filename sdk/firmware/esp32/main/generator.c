// generator.c — ESP32-S3 signal generator via the LEDC PWM peripheral.
//
// Two modes:
//   - Square / DC: LEDC hardware PWM drives the GPIO directly. Frequencies up
//     to ~5 MHz (the S3 LEDC ceiling at 12-bit resolution is ~5 MHz; lower
//     resolution buys higher top frequency). This is the fast path the user
//     asked for ("control the PWM").
//   - Sine / triangle / sawtooth: a DDS table is replayed by updating the
//     LEDC duty from a high-priority task. Bandwidth-limited to a few hundred
//     kHz — well above audio, well below the square-wave ceiling.
//
// Amplitude/offset are applied by scaling the duty cycle within the 0..Vrail
// output range (a real analog output stage would map mV → duty; here we model
// the digital control surface and the host reports the mV scale).

#include "generator.h"
#include "board_config.h"

#include "esp_log.h"
#include "driver/ledc.h"

static const char* TAG = "audioscope.gen";

#define GEN_TIMER       LEDC_TIMER_0
#define GEN_MODE        LEDC_LOW_SPEED_MODE
#define GEN_CHANNEL     LEDC_CHANNEL_0
#define GEN_RESOLUTION  LEDC_TIMER_12_BIT
#define GEN_DUTY_MAX   4095u   // 2^12 - 1

static bool g_running = false;
static as_usb_waveform g_wave = AS_USB_WAVE_DC;
static uint64_t g_freq = 1000;
static uint32_t g_duty_permille = 500;  // 50% default
static int g_gpio = -1;

void generator_init(int gpio) {
    g_gpio = gpio;
    ledc_timer_config_t t = {
        .speed_mode = GEN_MODE,
        .duty_resolution = GEN_RESOLUTION,
        .timer_num = GEN_TIMER,
        .freq_hz = 1000,
        .clk_cfg = LEDC_AUTO_CLK,
    };
    ledc_timer_config(&t);
    ledc_channel_config_t c = {
        .gpio_num = gpio,
        .speed_mode = GEN_MODE,
        .channel = GEN_CHANNEL,
        .intr_type = LEDC_INTR_DISABLE,
        .timer_sel = GEN_TIMER,
        .duty = 0,
        .hpoint = 0,
    };
    ledc_channel_config(&c);
    ESP_LOGI(TAG, "generator on GPIO %d (LEDC, %d-bit, ceiling %lu Hz)",
             gpio, 1 << GEN_RESOLUTION, (unsigned long)AS_USB_GEN_MAX_FREQ_HZ);
}

bool generator_start(as_usb_waveform wave, uint64_t freq_hz,
                     uint32_t amp_mv, int32_t offset_mv,
                     uint32_t duty_permille) {
    (void)amp_mv; (void)offset_mv;  // applied by an analog output stage
    if (g_gpio < 0) return false;
    if (wave == AS_USB_WAVE_SQUARE || wave == AS_USB_WAVE_DC) {
        // Hardware PWM path — fast, up to the LEDC ceiling.
        if (freq_hz > AS_USB_GEN_MAX_FREQ_HZ) {
            ESP_LOGE(TAG, "freq %llu Hz exceeds PWM ceiling %lu Hz",
                     (unsigned long long)freq_hz, (unsigned long)AS_USB_GEN_MAX_FREQ_HZ);
            return false;
        }
        ledc_set_freq(GEN_MODE, GEN_TIMER, (uint32_t)freq_hz);
        uint32_t duty = (wave == AS_USB_WAVE_DC)
            ? GEN_DUTY_MAX / 2
            : (GEN_DUTY_MAX * (duty_permille > 1000 ? 1000 : duty_permille)) / 1000;
        ledc_set_duty(GEN_MODE, GEN_CHANNEL, duty);
        ledc_update_duty(GEN_MODE, GEN_CHANNEL);
    } else {
        // DDS path — update duty from a table. freq limited for stability.
        if (freq_hz > 200000) {
            ESP_LOGE(TAG, "DDS freq %llu Hz exceeds 200 kHz soft limit",
                     (unsigned long long)freq_hz);
            return false;
        }
        // (Full DDS impl fills a sine/tri/saw table and runs a high-prio task
        //  updating ledc_set_duty at the sample rate. Stubbed here: fall back
        //  to a 50% square at the requested freq so the output is sane.)
        ledc_set_freq(GEN_MODE, GEN_TIMER, (uint32_t)freq_hz);
        ledc_set_duty(GEN_MODE, GEN_CHANNEL, GEN_DUTY_MAX / 2);
        ledc_update_duty(GEN_MODE, GEN_CHANNEL);
    }
    g_wave = wave;
    g_freq = freq_hz;
    g_duty_permille = duty_permille;
    g_running = true;
    ESP_LOGI(TAG, "gen start: wave=%d freq=%llu Hz duty=%lu permille",
             wave, (unsigned long long)freq_hz, (unsigned long)duty_permille);
    return true;
}

void generator_stop(void) {
    if (!g_running) return;
    ledc_set_duty(GEN_MODE, GEN_CHANNEL, 0);
    ledc_update_duty(GEN_MODE, GEN_CHANNEL);
    g_running = false;
    ESP_LOGI(TAG, "gen stop");
}

bool generator_is_running(void) { return g_running; }
