// audio-streaming-processor.js — playback worklet.
//
// Streams PCM chunks fetched by the main thread (use-streaming-playback.ts) to
// the AudioContext destination, AND — since the architecture migration (spec
// §C.3) — runs the SAME C++ DSP core (via @audio-scope-view/dsp-wasm) on the
// played samples, posting per-block magnitudes + measurements to the main
// thread for the WebGL scope renderer. This unifies the DSP source of truth:
// whether samples come from a live capture (dsp-processor) or from a stored
// recording (this worklet), the same C++ core runs on the audio thread.
//
// The WASM module is loaded by URL (passed in the `config` message from the
// main thread, which resolves the Vite-hashed asset URLs). The worklet can't
// use a bundler `import` (AudioWorklet global scope, flat public URL), so it
// dynamically imports the factory URL and points `locateFile` at the sibling
// .wasm URL. DSP load is failure-tolerant: if the module fails to load, audio
// still plays — only the per-block DSP frames stop (mirrors dsp-loader's
// graceful-degradation philosophy).

class AudioStreamingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.config = undefined;
    this.isPlaying = false;
    this.currentSample = 0;
    this.playbackSpeed = 1;

    this.chunkBuffer = new Map();
    this.pendingRequests = new Set();
    this.preloadAhead = 3;

    this.bufferAheadSeconds = 0.2;

    // ---- DSP (C++ core via WASM) ----
    this.dsp = null;            // loaded WASM module instance (null until ready)
    this.fftHandle = 0;
    this.tmpLenPtr = 0;
    this.dspSampleRate = 0;
    this.dspBlockBuffer = [];   // accumulates played samples until a full block
    this.dspBlockSize = 1024;   // samples per DSP block (matches the scope FFT window)

    this.port.addEventListener("message", (event) => {
      this.handleCommand(event.data);
    });

    this.port.postMessage({ type: "ready" });
  }

  // ---- WASM DSP lifecycle ------------------------------------------------ //

  async loadDsp(moduleUrl, binaryUrl) {
    try {
      // Dynamic import of the Emscripten MODULARIZE/EXPORT_ES6 factory. The
      // main thread passes the Vite-resolved (hashed) URL so this works in both
      // dev and prod without the worklet needing bundler resolution.
      const mod = await import(moduleUrl);
      const factory = mod.default;
      if (typeof factory !== "function") {
        throw new Error("audioscope.js did not export a MODULARIZE factory.");
      }
      // `locateFile` overrides the default import.meta.url-based .wasm lookup
      // (which would resolve relative to THIS worklet's URL — wrong). The
      // generated module only calls locateFile for "audioscope.wasm".
      this.dsp = await factory({
        locateFile: (p) => (p === "audioscope.wasm" ? binaryUrl : p),
      });
      this.fftHandle = this.dsp._em_fft_new();
      this.tmpLenPtr = this.dsp._malloc(4);
      if (!this.fftHandle || !this.tmpLenPtr) {
        throw new Error("WASM DSP init: alloc failure.");
      }
      this.port.postMessage({ type: "dsp_ready" });
    } catch (err) {
      // Playback is not blocked on DSP load; surface the failure and continue
      // as a plain PCM player (no per-block frames will be posted).
      this.dsp = null;
      this.port.postMessage({
        type: "dsp_error",
        message: String((err && err.message) || err),
      });
    }
  }

  // Copy a JS sample array onto the WASM heap (f32). Returns the byte pointer
  // (0 on failure). Caller MUST freePtr() after use.
  allocF32(samples) {
    const n = samples.length;
    const bytePtr = this.dsp._malloc(n * 4);
    if (!bytePtr) return 0;
    // HEAPF32 is a Float32Array view over the WASM heap; index by bytePtr>>2.
    this.dsp.HEAPF32.set(samples, bytePtr >> 2);
    return bytePtr;
  }

  freePtr(ptr) {
    if (ptr && this.dsp) this.dsp._em_free(ptr);
  }

  // Run magnitudes + waveform analysis on one block of played samples and post
  // the result to the main thread (transferred, zero-copy).
  emitDspFrame(blockSamples) {
    if (!this.dsp || !this.fftHandle) return;
    const sr = this.dspSampleRate;

    const inPtr = this.allocF32(blockSamples);
    if (!inPtr) return;
    try {
      // Magnitudes (Hann-windowed half-spectrum, dB). malloc'd by C++; freed here.
      const dataPtr = this.dsp._em_compute_magnitudes(
        this.fftHandle, inPtr, blockSamples.length, sr, this.tmpLenPtr,
      );
      const len = this.dsp.getValue(this.tmpLenPtr, "i32");
      const magnitudes = dataPtr
        ? this.dsp.HEAPF32.slice(dataPtr >> 2, (dataPtr >> 2) + len)
        : new Float32Array(0);

      // Waveform analysis: 9 consecutive f32 fields at the returned struct ptr.
      const structPtr = this.dsp._em_analyze_waveform(inPtr, blockSamples.length, sr);
      let analysis = null;
      if (structPtr) {
        const r = (off) => this.dsp.getValue(structPtr + off, "float");
        analysis = {
          peakAmplitude: r(0),
          negativePeakAmplitude: r(4),
          rmsAmplitude: r(8),
          dcOffset: r(12),
          crestFactor: r(16),
          zeroCrossingRate: r(20),
          dominantFrequency: r(24),
          thd: r(28),
          snr: r(32),
        };
      }

      // Transfer the magnitudes buffer (zero-copy) — analysis is a plain object.
      const transfer = magnitudes.buffer ? [magnitudes.buffer] : [];
      this.port.postMessage(
        { type: "frame", magnitudes, analysis, sampleRate: sr },
        transfer,
      );

      if (dataPtr) this.freePtr(dataPtr);
      if (structPtr) this.freePtr(structPtr);
    } finally {
      this.freePtr(inPtr);
    }
  }

  // ---- playback command handling ----------------------------------------- //

  handleCommand(command) {
    switch (command.type) {
      case "config": {
        this.config = command;
        this.dspSampleRate = command.sampleRate || 44100;
        this.dspBlockSize = command.dspBlockSize || 1024;

        this.port.postMessage({ type: "config_acknowledged" });

        // Kick off the WASM DSP load (idempotent — the worklet is constructed
        // once per playback session). The module URLs come from the main
        // thread, which resolved them via Vite `?url` imports.
        if (!this.dsp && command.wasmModuleUrl && command.wasmBinaryUrl) {
          this.loadDsp(command.wasmModuleUrl, command.wasmBinaryUrl);
        }
        break;
      }

      case "play": {
        this.isPlaying = true;
        this.preloadChunks();
        break;
      }

      case "pause": {
        this.isPlaying = false;
        break;
      }

      case "stop": {
        this.isPlaying = false;
        this.currentSample = 0;
        this.chunkBuffer.clear();
        this.pendingRequests.clear();
        this.dspBlockBuffer.length = 0;
        break;
      }

      case "seek": {
        this.currentSample = command.samplePosition;
        this.isPlaying = true;
        this.dspBlockBuffer.length = 0;
        this.preloadChunks();
        break;
      }

      case "set_speed": {
        this.playbackSpeed = command.speed;
        break;
      }

      case "chunk_data": {
        this.handleChunkReceived(command);
        break;
      }

      default: {
        break;
      }
    }
  }

  getChunkKey(startSample) {
    return `${startSample}`;
  }

  requestChunk(startSample, endSample, priority) {
    const key = this.getChunkKey(startSample);

    if (this.pendingRequests.has(key) || this.chunkBuffer.has(key)) {
      return;
    }

    this.pendingRequests.add(key);

    this.port.postMessage({
      type: "request_chunk",
      startSample,
      endSample,
      priority,
    });
  }

  preloadChunks() {
    if (!this.config) return;

    const { totalSamples, chunkSize, sampleRate } = this.config;

    const currentChunk = Math.floor(this.currentSample / chunkSize);
    const aheadChunks =
      Math.ceil((this.bufferAheadSeconds * sampleRate) / chunkSize) + this.preloadAhead;

    for (let index = 0; index < aheadChunks; index++) {
      const chunkStart = (currentChunk + index) * chunkSize;
      if (chunkStart >= totalSamples) break;

      const chunkEnd = Math.min(chunkStart + chunkSize, totalSamples);
      this.requestChunk(chunkStart, chunkEnd, aheadChunks - index);
    }

    const minChunkKey = (currentChunk - 2) * chunkSize;
    for (const key of this.chunkBuffer.keys()) {
      const chunkStart = Number.parseInt(key, 10);
      if (chunkStart < minChunkKey) {
        this.chunkBuffer.delete(key);
      }
    }
  }

  handleChunkReceived(data) {
    const key = this.getChunkKey(data.startSample);
    this.pendingRequests.delete(key);

    let samples;
    if (data.samples instanceof Float32Array) {
      samples = data.samples;
    } else if (data.samples && data.samples.buffer) {
      samples = new Float32Array(data.samples.buffer);
    } else {
      samples = new Float32Array(data.samples);
    }

    this.chunkBuffer.set(key, samples);

    this.port.postMessage({
      type: "buffer_status",
      bufferedChunks: this.chunkBuffer.size,
      currentSample: Math.floor(this.currentSample),
    });
  }

  process(inputs, outputs) {
    if (!this.config) {
      const output = outputs[0];
      if (output && output[0]) {
        output[0].fill(0);
      }
      return true;
    }

    const output = outputs[0];
    if (!output || !output[0]) {
      return true;
    }

    const outputBuffer = output[0];
    const { totalSamples, chunkSize } = this.config;
    const startSample = this.currentSample;

    for (let index = 0; index < outputBuffer.length; index++) {
      const sampleIndex = Math.floor(startSample + index * this.playbackSpeed);

      if (this.isPlaying && sampleIndex < totalSamples) {
        const chunkKey = this.getChunkKey(Math.floor(sampleIndex / chunkSize) * chunkSize);
        const chunk = this.chunkBuffer.get(chunkKey);

        if (chunk) {
          const chunkStart = Number.parseInt(chunkKey, 10);
          const offsetInChunk = Math.floor(sampleIndex - chunkStart);

          const sample = offsetInChunk < chunk.length ? chunk[offsetInChunk] : 0;
          outputBuffer[index] = sample;
          // Feed the played sample into the DSP block accumulator (only when
          // the core is loaded; otherwise skip — playback is unaffected).
          if (this.dsp) this.dspBlockBuffer.push(sample);
        } else {
          outputBuffer[index] = 0;
          const chunkStart = Math.floor(sampleIndex / chunkSize) * chunkSize;
          const chunkEnd = Math.min(chunkStart + chunkSize, totalSamples);
          this.requestChunk(chunkStart, chunkEnd, 100);
        }

        this.currentSample += this.playbackSpeed;

        if (
          Math.floor(this.currentSample / chunkSize) >
          Math.floor((this.currentSample - this.playbackSpeed) / chunkSize)
        ) {
          this.preloadChunks();
        }

        if (index % 2048 === 0) {
          this.port.postMessage({
            type: "position_update",
            currentSample: Math.floor(this.currentSample),
          });
        }
      } else {
        outputBuffer[index] = 0;

        if (this.currentSample >= totalSamples) {
          this.isPlaying = false;
          this.port.postMessage({ type: "ended" });
        }
      }
    }

    // Flush a complete DSP block (only when enough samples accumulated).
    if (this.dsp && this.dspBlockBuffer.length >= this.dspBlockSize) {
      const block = this.dspBlockBuffer.splice(0, this.dspBlockSize);
      this.emitDspFrame(block);
    }

    return true;
  }
}

registerProcessor("audio-streaming-processor", AudioStreamingProcessor);
