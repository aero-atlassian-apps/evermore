export class AudioPipeline {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private filterNode: BiquadFilterNode | null = null;
    private compressorNode: DynamicsCompressorNode | null = null;
    private destinationNode: MediaStreamAudioDestinationNode | null = null;

    private isRecording = false;
    private isSpeaking = false;

    // Audio buffer for current recording session
    private activeBuffer: Blob[] = [];

    // Minimum blob size to send (1KB) - prevents empty/tiny recordings
    private readonly MIN_BLOB_SIZE_BYTES = 1000;

    // Silence timeout: auto-notify if no speech detected within this time (ms)
    private readonly SILENCE_TIMEOUT_MS = 30000; // 30 seconds
    private silenceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private hasDetectedSpeech = false;

    // Event Callbacks
    public onVolumeChange: ((volume: number) => void) | null = null;
    public onSpeechStart: (() => void) | null = null;
    public onSpeechEnd: ((audioBlob: Blob) => void) | null = null;
    public onError: ((error: Error) => void) | null = null;
    /** Called if no speech is detected within SILENCE_TIMEOUT_MS after start() */
    public onSilenceTimeout: (() => void) | null = null;

    constructor() {
        console.log("AudioPipeline: Constructor");
        if (typeof window !== 'undefined' && !window.AudioContext) {
            console.error("Web Audio API not supported");
        }
    }

    private isWorkletLoaded = false;

    public async initialize() {
        console.log("AudioPipeline: Initializing...");
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000,
            });
            console.log("AudioPipeline: Context created state=", this.audioContext.state);

            // Load Worklet
            try {
                console.log("AudioPipeline: Adding module...");
                // Increase timeout to 10s to account for slow dev server compilation
                const addModulePromise = this.audioContext.audioWorklet.addModule('/audio-processor.js');
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout adding audio worklet module")), 10000)
                );
                await Promise.race([addModulePromise, timeoutPromise]);
                this.isWorkletLoaded = true;
                console.log("AudioPipeline: Module added.");
            } catch (e) {
                console.error("Failed to load audio worklet. Proceeding without VAD.", e);
                // We mark as not loaded, so we won't try to instantiate the node below
                this.isWorkletLoaded = false;
            }

            // Get User Media
            console.log("AudioPipeline: Requesting User Media...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                }
            });
            console.log("AudioPipeline: Stream acquired.");

            // Build Graph
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'highpass';
            this.filterNode.frequency.value = 80;

            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.compressorNode.threshold.value = -24;
            this.compressorNode.knee.value = 30;
            this.compressorNode.ratio.value = 12;
            this.compressorNode.attack.value = 0.003;
            this.compressorNode.release.value = 0.25;

            try {
                this.destinationNode = this.audioContext.createMediaStreamDestination();

                this.sourceNode.connect(this.filterNode);
                this.filterNode.connect(this.compressorNode);
                this.compressorNode.connect(this.destinationNode);

                // Only connect VAD if worklet loaded successfully
                if (this.isWorkletLoaded) {
                    this.workletNode = new AudioWorkletNode(this.audioContext, 'voice-activity-detector');
                    this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event.data);
                    this.filterNode.connect(this.workletNode);
                } else {
                    console.warn("AudioPipeline: Skipping VAD connection due to missing worklet.");
                }

                console.log("AudioPipeline: Graph connected.");
            } catch (e) {
                console.error("AudioPipeline: Graph connection failed", e);
            }

            this.setupMediaRecorder();

        } catch (err) {
            console.error("AudioPipeline Initialization Error:", err);
            if (this.onError) this.onError(err instanceof Error ? err : new Error(String(err)));
        }
    }

    private setupMediaRecorder() {
        if (!this.destinationNode) return;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
            ? 'audio/webm; codecs=opus'
            : 'audio/webm';

        console.log("AudioPipeline: Setup MediaRecorder with", mimeType);

        this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, {
            mimeType,
            audioBitsPerSecond: 48000  // Higher bitrate for better quality
        });

        // Collect ALL chunks for the current recording session
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.activeBuffer.push(e.data);
            }
        };

        // When recording stops, we have a COMPLETE WebM file
        this.mediaRecorder.onstop = () => {
            if (this.activeBuffer.length > 0 && this.pendingSpeechEnd) {
                // Create a single complete WebM blob from all chunks
                const blob = new Blob(this.activeBuffer, { type: mimeType });
                this.activeBuffer = [];

                // BUG-003 FIX: Only send if blob is large enough (prevents empty/tiny recordings)
                if (blob.size >= this.MIN_BLOB_SIZE_BYTES) {
                    console.log("AudioPipeline: Complete WebM blob created:", blob.size, "bytes");
                    if (this.onSpeechEnd) this.onSpeechEnd(blob);
                } else {
                    console.warn("AudioPipeline: Blob too small, discarding:", blob.size, "bytes");
                }
            }
            this.pendingSpeechEnd = false;

            // Restart recording for next segment (if still active)
            if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
                this.mediaRecorder.start();
            }
        };

        // Start recording immediately (will be stopped on speech end)
        this.mediaRecorder.start();
    }

    // Flag to track pending speech end
    private pendingSpeechEnd = false;

    private handleWorkletMessage(data: any) {
        switch (data.type) {
            case 'VOLUME':
                if (this.onVolumeChange) this.onVolumeChange(data.volume);
                break;
            case 'SPEECH_START':
                console.log("AudioPipeline: SPEECH_START");
                this.isSpeaking = true;
                this.hasDetectedSpeech = true;
                this.clearSilenceTimeout(); // Speech detected, cancel timeout
                // Clear buffer and restart recording for fresh segment
                this.activeBuffer = [];
                if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
                    this.mediaRecorder.start();
                }
                if (this.onSpeechStart) this.onSpeechStart();
                break;
            case 'SPEECH_END':
                console.log("AudioPipeline: SPEECH_END");
                this.isSpeaking = false;
                this.finalizeSegment();
                break;
        }
    }

    private finalizeSegment() {
        // Stop recording to trigger onstop handler which creates complete WebM
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.pendingSpeechEnd = true;
            this.mediaRecorder.stop();
        }
    }

    private clearSilenceTimeout() {
        if (this.silenceTimeoutId) {
            clearTimeout(this.silenceTimeoutId);
            this.silenceTimeoutId = null;
        }
    }

    public async start() {
        console.log("AudioPipeline: Starting...");
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log("AudioPipeline: Context resumed.");
        }
        this.isRecording = true;
        this.hasDetectedSpeech = false;

        // Start silence timeout - if no speech detected in 30s, notify the UI
        this.clearSilenceTimeout();
        this.silenceTimeoutId = setTimeout(() => {
            if (this.isRecording && !this.hasDetectedSpeech) {
                console.warn("AudioPipeline: Silence timeout - no speech detected in 30 seconds.");
                if (this.onSilenceTimeout) this.onSilenceTimeout();
            }
        }, this.SILENCE_TIMEOUT_MS);
    }

    public stop() {
        console.log("AudioPipeline: Stopping...");
        this.isRecording = false;
        this.clearSilenceTimeout();
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}
