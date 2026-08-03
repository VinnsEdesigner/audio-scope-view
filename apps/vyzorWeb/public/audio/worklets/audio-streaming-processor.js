class AudioStreamingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.config = null;
    this.isPlaying = false;
    this.currentSample = 0;
    this.playbackSpeed = 1.0;

    this.chunkBuffer = new Map();
    this.pendingRequests = new Set();
    this.preloadAhead = 3;

    this.bufferAheadSeconds = 0.2;

    this.port.onmessage = (event) => {
      this.handleCommand(event.data);
    };

    this.port.postMessage({ type: "ready" });
  }

  handleCommand(command) {
    console.log("[Worklet] Received command:", command.type, "config:", !!this.config);
    switch (command.type) {
      case "config":
        this.config = command;
        console.log("[Worklet] Config set:", JSON.stringify({recordingId: command.recordingId, totalSamples: command.totalSamples, sampleRate: command.sampleRate, chunkSize: command.chunkSize, baseUrl: command.baseUrl}));
        // Acknowledge config receipt
        this.port.postMessage({ type: 'config_acknowledged' });
        break;

      case "play":
        console.log("[Worklet] Play command, isPlaying:", this.isPlaying, "config:", !!this.config);
        this.isPlaying = true;
        this.preloadChunks();
        break;

      case "pause":
        console.log("[Worklet] Pause command");
        this.isPlaying = false;
        break;

      case "stop":
        console.log("[Worklet] Stop command");
        this.isPlaying = false;
        this.currentSample = 0;
        this.chunkBuffer.clear();
        this.pendingRequests.clear();
        break;

      case "seek":
        console.log("[Worklet] Seek command:", command.samplePosition);
        this.currentSample = command.samplePosition;
        this.isPlaying = true;
        this.preloadChunks();
        break;

      case "set_speed":
        console.log("[Worklet] Set speed:", command.speed);
        this.playbackSpeed = command.speed;
        break;

      case "chunk_data":
        console.log("[Worklet] Chunk received:", command.startSample, "-", command.endSample, "samples length:", command.samples ? command.samples.length : 0);
        this.handleChunkReceived(command);
        break;
    }
  }

  getChunkKey(startSample) {
    return `${startSample}`;
  }

  requestChunk(startSample, endSample, priority) {
    const key = this.getChunkKey(startSample);

    if (this.pendingRequests.has(key) || this.chunkBuffer.has(key)) {
      console.log("[Worklet] requestChunk: skipping", key, "(already pending or buffered)");
      return;
    }

    this.pendingRequests.add(key);
    console.log("[Worklet] requestChunk: requesting", startSample, "-", endSample, "priority:", priority);

    this.port.postMessage({
      type: "request_chunk",
      startSample,
      endSample,
      priority,
    });
  }

  preloadChunks() {
    if (!this.config) {
      console.log("[Worklet] preloadChunks: config is null, returning early");
      return;
    }

    console.log("[Worklet] preloadChunks called, currentSample:", this.currentSample, "config:", !!this.config);
    const { totalSamples, chunkSize, sampleRate } = this.config;

    const currentChunk = Math.floor(this.currentSample / chunkSize);
    const aheadChunks =
      Math.ceil((this.bufferAheadSeconds * sampleRate) / chunkSize) + this.preloadAhead;

    console.log("[Worklet] preloadChunks: requesting", aheadChunks, "chunks starting from chunk", currentChunk);
    for (let i = 0; i < aheadChunks; i++) {
      const chunkStart = (currentChunk + i) * chunkSize;
      if (chunkStart >= totalSamples) break;

      const chunkEnd = Math.min(chunkStart + chunkSize, totalSamples);
      this.requestChunk(chunkStart, chunkEnd, aheadChunks - i);
    }

    const minChunkKey = (currentChunk - 2) * chunkSize;
    for (const key of this.chunkBuffer.keys()) {
      const chunkStart = parseInt(key, 10);
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
      console.log("[Worklet] process: config is null, outputting silence");
      return true;
    }

    const output = outputs[0];
    if (!output || !output[0]) {
      console.log("[Worklet] process: no output buffer");
      return true;
    }

    const outputBuffer = output[0];
    const { totalSamples, chunkSize } = this.config;
    const startSample = this.currentSample;

    console.log("[Worklet] process called: isPlaying=", this.isPlaying, "currentSample=", this.currentSample, "totalSamples=", totalSamples, "outputBuffer.length=", outputBuffer.length);

    for (let i = 0; i < outputBuffer.length; i++) {
      const sampleIndex = Math.floor(startSample + i * this.playbackSpeed);

      if (this.isPlaying && sampleIndex < totalSamples) {
        const chunkKey = this.getChunkKey(Math.floor(sampleIndex / chunkSize) * chunkSize);
        const chunk = this.chunkBuffer.get(chunkKey);

        if (chunk) {
          const chunkStart = parseInt(chunkKey, 10);
          const offsetInChunk = Math.floor(sampleIndex - chunkStart);

          if (offsetInChunk < chunk.length) {
            outputBuffer[i] = chunk[offsetInChunk];
          } else {
            outputBuffer[i] = 0;
          }
        } else {
          outputBuffer[i] = 0;
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

        if (i % 2048 === 0) {
          this.port.postMessage({
            type: "position_update",
            currentSample: Math.floor(this.currentSample),
          });
        }
      } else {
        outputBuffer[i] = 0;

        if (this.currentSample >= totalSamples) {
          console.log("[Worklet] playback ended, currentSample=", this.currentSample, "totalSamples=", totalSamples);
          this.isPlaying = false;
          this.port.postMessage({ type: "ended" });
        }
      }
    }

    return true;
  }
}

registerProcessor("audio-streaming-processor", AudioStreamingProcessor);
