import type {
	Waveform,
	WaveformServer,
	WaveformSummary,
	WaveformSummaryServer,
	WaveformStatistics,
	WaveformStatisticsServer,
} from "./types";

/**
 * Transform server response (snake_case) to domain type (camelCase)
 */
export function waveformFromRaw(serverWaveform: WaveformServer): Waveform {
	return {
		id: serverWaveform.id,
		scopeId: serverWaveform.scope_id,
		samples: serverWaveform.samples,
		sampleCount: serverWaveform.sample_count,
		timestamp: new Date(serverWaveform.timestamp),
		durationMs: serverWaveform.duration_ms,
		peakAmplitude: serverWaveform.peak_amplitude,
		rmsAmplitude: serverWaveform.rms_amplitude,
	};
}

/**
 * Transform array of server responses to domain types
 */
export function waveformsFromRaw(serverWaveforms: WaveformServer[]): Waveform[] {
	return serverWaveforms.map(waveformFromRaw);
}

export function waveformSummaryFromRaw(serverSummary: WaveformSummaryServer): WaveformSummary {
	return {
		id: serverSummary.id,
		scopeId: serverSummary.scope_id,
		sampleCount: serverSummary.sample_count,
		timestamp: new Date(serverSummary.timestamp),
		durationMs: serverSummary.duration_ms,
		peakAmplitude: serverSummary.peak_amplitude,
		rmsAmplitude: serverSummary.rms_amplitude,
	};
}

export function waveformStatisticsFromRaw(serverStats: WaveformStatisticsServer): WaveformStatistics {
	return {
		totalCount: serverStats.total_count,
		totalSamples: serverStats.total_samples,
		averagePeak: serverStats.average_peak,
		averageRms: serverStats.average_rms,
	};
}

/**
 * Compute waveform stats from samples (client-side computation)
 */
export function computeWaveformStats(samples: number[]) {
	if (samples.length === 0) {
		return { min: 0, max: 0, mean: 0, standardDeviation: 0 };
	}

	const minimum = Math.min(...samples);
	const maximum = Math.max(...samples);
	const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
	const variance = samples.reduce((sum, sample) => sum + Math.pow(sample - mean, 2), 0) / samples.length;
	const standardDeviation = Math.sqrt(variance);

	return { min: minimum, max: maximum, mean, standardDeviation };
}

/**
 * Resample waveform for display
 */
export function resampleWaveform(samples: number[], targetLength: number): number[] {
	if (samples.length === targetLength) return samples;
	if (samples.length === 0 || targetLength <= 0) return [];

	const result: number[] = [];
	const ratio = samples.length / targetLength;

	for (let index = 0; index < targetLength; index++) {
		const sourceIndex = index * ratio;
		const leftIndex = Math.floor(sourceIndex);
		const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
		const fraction = sourceIndex - leftIndex;
		result.push(samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction);
	}

	return result;
}

/**
 * Convert waveform to time domain for charting
 */
export function waveformToTimeDomain(waveform: { samples: number[]; sampleRate: number }) {
	const dt = 1000 / waveform.sampleRate;
	return waveform.samples.map((amplitude, index) => ({
		time: index * dt,
		amplitude,
	}));
}
