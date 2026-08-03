/**
 * Audio Streaming Worklet Processor
 * 
 * This worklet runs in a separate audio thread and handles streaming audio playback
 * by fetching chunks on-demand without buffering the entire file.
 * 
 * Communication protocol:
 * - Messages FROM processor: 'ready', 'request_chunk', 'position_update', 'buffer_status', 'ended'
 * - Messages TO processor: 'config', 'play', 'pause', 'stop', 'seek', 'set_speed', 'chunk_data'
 */

class AudioStreamingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Configuration
    this.config = null;
    this.isPlaying = false;
    this.currentSample = 0;
    this.playbackSpeed = 1.0;
    
    // Chunk buffer management
    this.chunkBuffer = new Map();
    this.pendingRequests = new Set();
    this.preloadAhead = 3; // Number of chunks to preload ahead
    
    // Buffer settings
    this.bufferAheadSeconds = 0.2; // seconds to keep buffered ahead
    
    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      this.handleCommand(event.data);
    };
    
    // Send ready message
    this.port.postMessage({ type: 'ready' });
  }
  
  handleCommand(command) {
    switch (command.type) {
      case 'config':
        this.config = command;
        break;
        
      case 'play':
        this.isPlaying = true;
        this.preloadChunks();
        break;
        
      case 'pause':
        this.isPlaying = false;
        break;
        
      case 'stop':
        this.isPlaying = false;
        this.currentSample = 0;
        this.chunkBuffer.clear();
        this.pendingRequests.clear();
        break;
        
      case 'seek':
        this.currentSample = command.samplePosition;
        this.isPlaying = true;
        this.preloadChunks();
        break;
        
      case 'set_speed':
        this.playbackSpeed = command.speed;
        break;
        
      case 'chunk_data':
        this.handleChunkReceived(command);
        break;
    }
  }
  
  getChunkKey(startSample) {
    return `${startSample}`;
  }
  
  requestChunk(startSample, endSample, priority) {
    const key = this.getChunkKey(startSample);
    
    // Don't request if already pending or buffered
    if (this.pendingRequests.has(key) || this.chunkBuffer.has(key)) {
      return;
    }
    
    this.pendingRequests.add(key);
    
    // Request chunk from main thread (which will fetch from server)
    this.port.postMessage({
      type: 'request_chunk',
      startSample,
      endSample,
      priority,
    });
  }
  
  preloadChunks() {
    if (!this.config) return;
    
    const { totalSamples, chunkSize, sampleRate } = this.config;
    
    // Calculate which chunks we need
    const currentChunk = Math.floor(this.currentSample / chunkSize);
    const aheadChunks = Math.ceil((this.bufferAheadSeconds * sampleRate) / chunkSize) + this.preloadAhead;
    
    // Request chunks ahead
    for (let i = 0; i < aheadChunks; i++) {
      const chunkStart = (currentChunk + i) * chunkSize;
      if (chunkStart >= totalSamples) break;
      
      const chunkEnd = Math.min(chunkStart + chunkSize, totalSamples);
      this.requestChunk(chunkStart, chunkEnd, aheadChunks - i);
    }
    
    // Clean up old chunks (behind playback position)
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
    
    // Convert Float32Array if needed
    let samples;
    if (data.samples instanceof Float32Array) {
      samples = data.samples;
    } else if (data.samples && data.samples.buffer) {
      // It's a transferred ArrayBuffer - create new Float32Array
      samples = new Float32Array(data.samples.buffer);
    } else {
      // Convert from regular array
      samples = new Float32Array(data.samples);
    }
    
    this.chunkBuffer.set(key, samples);
    
    // Report buffer status
    this.port.postMessage({
      type: 'buffer_status',
      bufferedChunks: this.chunkBuffer.size,
      currentSample: Math.floor(this.currentSample),
    });
  }
  
  process(inputs, outputs) {
    if (!this.config) {
      // Output silence if not configured
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
    
    for (let i = 0; i < outputBuffer.length; i++) {
      const sampleIndex = Math.floor(startSample + i * this.playbackSpeed);
      
      if (this.isPlaying && sampleIndex < totalSamples) {
        // Find the chunk containing currentSample
        const chunkKey = this.getChunkKey(Math.floor(sampleIndex / chunkSize) * chunkSize);
        const chunk = this.chunkBuffer.get(chunkKey);
        
        if (chunk) {
          // Calculate offset within chunk
          const chunkStart = parseInt(chunkKey, 10);
          const offsetInChunk = Math.floor(sampleIndex - chunkStart);
          
          if (offsetInChunk < chunk.length) {
            outputBuffer[i] = chunk[offsetInChunk];
          } else {
            outputBuffer[i] = 0;
          }
        } else {
          // Chunk not available - output silence and request it
          outputBuffer[i] = 0;
          const chunkStart = Math.floor(sampleIndex / chunkSize) * chunkSize;
          const chunkEnd = Math.min(chunkStart + chunkSize, totalSamples);
          this.requestChunk(chunkStart, chunkEnd, 100);
        }
        
        // Advance position
        this.currentSample += this.playbackSpeed;
        
        // Check if we need to preload more
        if (Math.floor(this.currentSample / chunkSize) > Math.floor((this.currentSample - this.playbackSpeed) / chunkSize)) {
          this.preloadChunks();
        }
        
        // Report position periodically
        if (i % 2048 === 0) {
          this.port.postMessage({
            type: 'position_update',
            currentSample: Math.floor(this.currentSample),
          });
        }
      } else {
        // End of playback or paused
        outputBuffer[i] = 0;
        
        if (this.currentSample >= totalSamples) {
          this.isPlaying = false;
          this.port.postMessage({ type: 'ended' });
        }
      }
    }
    
    return true;
  }
}

registerProcessor('audio-streaming-processor', AudioStreamingProcessor);
