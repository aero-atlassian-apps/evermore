'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface UsePauseDetectionOptions {
    /** Silence duration threshold in milliseconds */
    silenceThresholdMs?: number;
    /** Called when pause is detected */
    onPauseDetected?: (durationMs: number) => void;
    /** Called when speech resumes after pause */
    onSpeechResume?: () => void;
    /** Whether to enable detection */
    enabled?: boolean;
}

interface UsePauseDetectionReturn {
    /** Current silence duration in milliseconds */
    silenceDuration: number;
    /** Whether currently in a pause state */
    isPaused: boolean;
    /** Record that speech has occurred (resets timer) */
    recordSpeech: () => void;
    /** Manually reset the pause state */
    reset: () => void;
}

/**
 * usePauseDetection - Detects when user stops speaking
 * 
 * Uses a simple timer-based approach:
 * - Timer starts when speech ends
 * - Timer resets when speech resumes
 * - Callback fires when silence exceeds threshold
 * 
 * @example
 * ```tsx
 * const { isPaused, silenceDuration, recordSpeech } = usePauseDetection({
 *   silenceThresholdMs: 3000,
 *   onPauseDetected: (duration) => console.log(`Paused for ${duration}ms`)
 * });
 * ```
 */
export function usePauseDetection({
    silenceThresholdMs = 3000,
    onPauseDetected,
    onSpeechResume,
    enabled = true,
}: UsePauseDetectionOptions = {}): UsePauseDetectionReturn {
    const [silenceDuration, setSilenceDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const lastSpeechTimeRef = useRef<number>(0);
    // Initialize on mount
    useEffect(() => {
        lastSpeechTimeRef.current = Date.now();
    }, []);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const pauseTriggeredRef = useRef(false);

    // Update silence duration every 100ms
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const duration = now - lastSpeechTimeRef.current;
            setSilenceDuration(duration);

            if (duration >= silenceThresholdMs && !pauseTriggeredRef.current) {
                setIsPaused(true);
                pauseTriggeredRef.current = true;
                onPauseDetected?.(duration);
            }
        }, 100);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, silenceThresholdMs, onPauseDetected]);

    const recordSpeech = useCallback(() => {
        const wasPaused = pauseTriggeredRef.current;

        lastSpeechTimeRef.current = Date.now();
        setSilenceDuration(0);
        setIsPaused(false);
        pauseTriggeredRef.current = false;

        if (wasPaused) {
            onSpeechResume?.();
        }
    }, [onSpeechResume]);

    const reset = useCallback(() => {
        lastSpeechTimeRef.current = Date.now();
        setSilenceDuration(0);
        setIsPaused(false);
        pauseTriggeredRef.current = false;
    }, []);

    return {
        silenceDuration,
        isPaused,
        recordSpeech,
        reset,
    };
}

/**
 * useVolumeMonitor - Monitors audio volume level from AudioPipeline
 * 
 * Provides a normalized volume level (0-1) for visualization
 */
export function useVolumeMonitor() {
    const [volumeLevel, setVolumeLevel] = useState(0);
    const smoothedRef = useRef(0);

    const updateVolume = useCallback((rawVolume: number) => {
        // Smooth the volume for visual display
        const targetVolume = Math.min(1, Math.max(0, rawVolume));
        smoothedRef.current += (targetVolume - smoothedRef.current) * 0.3;
        setVolumeLevel(smoothedRef.current);
    }, []);

    const reset = useCallback(() => {
        smoothedRef.current = 0;
        setVolumeLevel(0);
    }, []);

    return {
        volumeLevel,
        updateVolume,
        reset,
    };
}

/**
 * useSessionTimer - Tracks session duration
 */
export function useSessionTimer(isActive: boolean = true) {
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState<Date | null>(null);

    useEffect(() => {
        if (isActive && !startTime) {
            setTimeout(() => setStartTime(new Date()), 0);
        }
    }, [isActive, startTime]);

    useEffect(() => {
        if (!isActive || !startTime) return;

        const interval = setInterval(() => {
            setDuration(Math.floor((Date.now() - startTime.getTime()) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, startTime]);

    const formatDuration = useCallback(() => {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [duration]);

    return {
        duration,
        startTime: startTime || new Date(), // Fallback for initial render
        formatDuration,
    };
}
