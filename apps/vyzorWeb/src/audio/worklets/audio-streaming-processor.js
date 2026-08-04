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

    this.port.addEventListener("message", (event) => {
      this.handleCommand(event.data);
    });

    this.port.postMessage({ type: "ready" });
  }

  handleCommand(command) {
    switch (command.type) {
      case "config": {
        this.config = command;

        this.port.postMessage({ type: "config_acknowledged" });
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
        break;
      }

      case "seek": {
        this.currentSample = command.samplePosition;
        this.isPlaying = true;
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

          outputBuffer[index] = offsetInChunk < chunk.length ? chunk[offsetInChunk] : 0;
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

    return true;
  }
}

registerProcessor("audio-streaming-processor", AudioStreamingProcessor);
