class VoiceActivityDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this._volume = 0;

    // VAD Parameters - Tuned for fast speech and pre-recorded audio
    this._sampleRate = 16000;
    this._minEnergy = 0.0008; // Lowered for quiet speech
    this._vadThreshold = 0.008; // Base threshold, lowered for sensitivity
    this._noiseEnergy = 0.001;
    this._alpha = 0.95;
    this._hangoverFrames = 75; // Increased from 50 - waits longer after speech stops
    this._hangoverCounter = 0;
    this._isSpeaking = false;

    // Adaptive Noise Floor
    this._noiseFrames = 0;
    this._noiseAccumulator = 0;

    // Message throttling
    this._lastMessageTime = currentTime;

    // Segment tracking for debugging
    this._segmentCount = 0;
    this._segmentStartTime = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input.length) return true;

    const channelData = input[0];
    const frameSize = channelData.length;

    // 1. Calculate RMS of this frame
    let sumSquares = 0;
    for (let i = 0; i < frameSize; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / frameSize);

    // 2. Smooth volume for UI
    this._volume = this._volume * 0.8 + rms * 0.2;

    // 3. Adaptive Noise Floor Estimation
    if (rms < this._vadThreshold) {
      this._noiseEnergy = this._noiseEnergy * 0.995 + rms * 0.005;
    }

    // Dynamic Threshold: 2x above noise floor (lowered from 3x for sensitivity)
    // This makes it easier to detect quieter speech
    const dynamicThreshold = Math.max(this._minEnergy, this._noiseEnergy * 2.0);

    // 4. VAD Logic
    const isCurrentlyActive = rms > dynamicThreshold;

    if (isCurrentlyActive) {
      this._hangoverCounter = this._hangoverFrames;
    } else if (this._hangoverCounter > 0) {
      this._hangoverCounter--;
    }

    const isSpeakingState = this._hangoverCounter > 0;

    // 5. State Change Detection with logging
    if (isSpeakingState && !this._isSpeaking) {
      this._isSpeaking = true;
      this._segmentCount++;
      this._segmentStartTime = currentTime;
      this.port.postMessage({
        type: 'SPEECH_START',
        segment: this._segmentCount,
        timestamp: currentTime
      });
    } else if (!isSpeakingState && this._isSpeaking) {
      this._isSpeaking = false;
      const duration = currentTime - this._segmentStartTime;
      this.port.postMessage({
        type: 'SPEECH_END',
        segment: this._segmentCount,
        durationMs: Math.round(duration * 1000),
        timestamp: currentTime
      });
    }

    // 6. Periodic Updates (every ~100ms)
    if (currentTime - this._lastMessageTime > 0.1) {
      this.port.postMessage({
        type: 'VOLUME',
        volume: this._volume,
        threshold: dynamicThreshold,
        isSpeaking: this._isSpeaking,
        segment: this._segmentCount
      });
      this._lastMessageTime = currentTime;
    }

    return true;
  }
}

registerProcessor('voice-activity-detector', VoiceActivityDetector);

