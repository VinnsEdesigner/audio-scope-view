#![allow(dead_code)]

use std::f64::consts::PI;

#[derive(Debug, Clone, Copy)]
pub enum NoiseType {
    White,
    Pink,
    Brown,
}

#[derive(Debug, Clone)]
pub enum WaveformGenerator {
    Sine {
        frequency: f64,
        amplitude: f32,
        phase: f64,
    },
    Square {
        frequency: f64,
        amplitude: f32,
        duty_cycle: f32,
        phase: f64,
    },
    Sawtooth {
        frequency: f64,
        amplitude: f32,
        phase: f64,
    },
    Triangle {
        frequency: f64,
        amplitude: f32,
        phase: f64,
    },
    Noise {
        noise_type: NoiseType,
        amplitude: f32,
    },
    Chirp {
        start_freq: f64,
        end_freq: f64,
        amplitude: f32,
        phase: f64,
    },
    AM {
        carrier_freq: f64,
        modulator_freq: f64,
        depth: f32,
        amplitude: f32,
        phase: f64,
    },
    FM {
        carrier_freq: f64,
        deviation: f64,
        mod_freq: f64,
        amplitude: f32,
        phase: f64,
    },
    Impulse {
        frequency: f64,
        amplitude: f32,
    },
    MultiTone {
        frequencies: Vec<f64>,
        amplitudes: Vec<f32>,
        phase: f64,
    },
}

impl WaveformGenerator {
    pub fn sine(frequency: f64, amplitude: f32) -> Self {
        Self::Sine { frequency, amplitude, phase: 0.0 }
    }

    pub fn square(frequency: f64, amplitude: f32) -> Self {
        Self::Square { frequency, amplitude, duty_cycle: 0.5, phase: 0.0 }
    }

    pub fn sawtooth(frequency: f64, amplitude: f32) -> Self {
        Self::Sawtooth { frequency, amplitude, phase: 0.0 }
    }

    pub fn triangle(frequency: f64, amplitude: f32) -> Self {
        Self::Triangle { frequency, amplitude, phase: 0.0 }
    }

    pub fn white_noise(amplitude: f32) -> Self {
        Self::Noise { noise_type: NoiseType::White, amplitude }
    }

    pub fn pink_noise(amplitude: f32) -> Self {
        Self::Noise { noise_type: NoiseType::Pink, amplitude }
    }

    pub fn brown_noise(amplitude: f32) -> Self {
        Self::Noise { noise_type: NoiseType::Brown, amplitude }
    }

    pub fn generate(&self, sample_rate: f64, num_samples: usize) -> Vec<f32> {
        match self {
            Self::Sine { frequency, amplitude, phase } => {
                generate_sine(*frequency, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::Square { frequency, amplitude, duty_cycle, phase } => {
                generate_square(*frequency, *amplitude, *duty_cycle, *phase, sample_rate, num_samples)
            }
            Self::Sawtooth { frequency, amplitude, phase } => {
                generate_sawtooth(*frequency, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::Triangle { frequency, amplitude, phase } => {
                generate_triangle(*frequency, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::Noise { noise_type, amplitude } => {
                generate_noise(noise_type, *amplitude, num_samples)
            }
            Self::Chirp { start_freq, end_freq, amplitude, phase } => {
                generate_chirp(*start_freq, *end_freq, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::AM { carrier_freq, modulator_freq, depth, amplitude, phase } => {
                generate_am(*carrier_freq, *modulator_freq, *depth, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::FM { carrier_freq, deviation, mod_freq, amplitude, phase } => {
                generate_fm(*carrier_freq, *deviation, *mod_freq, *amplitude, *phase, sample_rate, num_samples)
            }
            Self::Impulse { frequency, amplitude } => {
                generate_impulse(*frequency, *amplitude, sample_rate, num_samples)
            }
            Self::MultiTone { frequencies, amplitudes, phase } => {
                generate_multi_tone(frequencies, amplitudes, *phase, sample_rate, num_samples)
            }
        }
    }
}

fn generate_sine(freq: f64, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        let value = (2.0 * PI * freq * t + phase).sin() as f32 * amp;
        samples.push(value);
    }
    samples
}

fn generate_square(freq: f64, amp: f32, duty_cycle: f32, _phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    let period = sample_rate / freq;
    let duty_samples = (period * duty_cycle as f64) as usize;
    
    for i in 0..n {
        let pos = (i % period as usize) as f64;
        let value: f32 = if pos < duty_samples as f64 { amp } else { -amp };
        samples.push(value);
    }
    samples
}

fn generate_sawtooth(freq: f64, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    let period = sample_rate / freq;
    
    for i in 0..n {
        let t = i as f64 / period;
        let value = (2.0 * (t + phase / (2.0 * PI)).rem_euclid(1.0) - 1.0) as f32 * amp;
        samples.push(value);
    }
    samples
}

fn generate_triangle(freq: f64, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    let period = sample_rate / freq;
    
    for i in 0..n {
        let t = (i as f64 / period + phase / (2.0 * PI)).rem_euclid(1.0);
        let value = if t < 0.5 {
            4.0 * t - 1.0
        } else {
            -4.0 * t + 3.0
        };
        samples.push(value as f32 * amp);
    }
    samples
}

fn generate_noise(noise_type: &NoiseType, amp: f32, n: usize) -> Vec<f32> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    
    match noise_type {
        NoiseType::White => {
            (0..n).map(|_| rng.gen_range(-amp..amp)).collect()
        }
        NoiseType::Pink => {
            let white: Vec<f64> = (0..n).map(|_| rng.gen_range(-1.0..1.0)).collect();
            let mut pink: Vec<f64> = vec![0.0; n];
            let mut b0 = 0.0f64; let mut b1 = 0.0f64; let mut b2 = 0.0f64;
            let mut b3 = 0.0f64; let mut b4 = 0.0f64; let mut b5 = 0.0f64; let mut b6 = 0.0f64;
            
            for (i, sample) in white.iter().enumerate() {
                b0 = 0.99886 * b0 + sample * 0.0555179;
                b1 = 0.99332 * b1 + sample * 0.0750759;
                b2 = 0.96900 * b2 + sample * 0.1538520;
                b3 = 0.86650 * b3 + sample * 0.3104856;
                b4 = 0.55000 * b4 + sample * 0.5329522;
                b5 = -0.7616 * b5 - sample * 0.0168980;
                pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + sample * 0.5362) * amp as f64 / 7.0;
                b6 = sample * 0.115926;
            }
            pink.into_iter().map(|x| (x as f32).max(-amp).min(amp)).collect()
        }
        NoiseType::Brown => {
            let mut brown = Vec::with_capacity(n);
            let mut last = 0.0f64;
            for _ in 0..n {
                let white = rng.gen_range(-1.0..1.0);
                last = (last + 0.02 * white) / 1.02;
                brown.push(((last * 3.5) as f32 * amp / 7.0).max(-amp).min(amp));
            }
            brown
        }
    }
}

fn generate_chirp(start_freq: f64, end_freq: f64, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        let freq = start_freq + (end_freq - start_freq) * t / (n as f64 / sample_rate);
        let value = (2.0 * PI * freq * t + phase).sin() as f32 * amp;
        samples.push(value);
    }
    samples
}

fn generate_am(carrier_freq: f64, modulator_freq: f64, depth: f32, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        let modulator = ((2.0 * PI * modulator_freq * t).sin() * depth as f64 / 2.0 + 1.0 - depth as f64 / 2.0) as f32;
        let carrier = (2.0 * PI * carrier_freq * t + phase).sin() as f32;
        samples.push(carrier * modulator * amp);
    }
    samples
}

fn generate_fm(carrier_freq: f64, deviation: f64, mod_freq: f64, amp: f32, phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        let instantaneous_freq = carrier_freq + deviation * (2.0 * PI * mod_freq * t).sin();
        let value = (2.0 * PI * instantaneous_freq * t + phase).sin() as f32 * amp;
        samples.push(value);
    }
    samples
}

fn generate_impulse(freq: f64, amp: f32, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = vec![0.0f32; n];
    let period = (sample_rate / freq) as usize;
    for i in (0..n).step_by(period.max(1)) {
        if i < n {
            samples[i] = amp;
        }
    }
    samples
}

fn generate_multi_tone(freqs: &[f64], amps: &[f32], phase: f64, sample_rate: f64, n: usize) -> Vec<f32> {
    let mut samples = vec![0.0f32; n];
    let num_tones = freqs.len().min(amps.len());
    
    for (i, sample) in samples.iter_mut().enumerate().take(n) {
        let t = i as f64 / sample_rate;
        let mut value = 0.0f32;
        for j in 0..num_tones {
            value += (2.0 * PI * freqs[j] * t + phase).sin() as f32 * amps[j];
        }
        *sample = value;
    }
    samples
}
