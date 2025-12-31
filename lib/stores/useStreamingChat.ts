/**
 * useStreamingChat - React hook for SSE-based streaming chat
 * 
 * Consumes the /api/chat/stream endpoint and provides:
 * - Real-time agent state updates
 * - Progressive token streaming
 * - Error handling and reconnection
 */

import { useState, useCallback, useRef } from 'react';

export type AgentState =
    | 'idle'
    | 'listening'
    | 'understanding'
    | 'checking'
    | 'recalling'
    | 'thinking'
    | 'reasoning'
    | 'responding'
    | 'complete'
    | 'error';

export interface StreamingState {
    agentState: AgentState;
    stateDetails: string;
    streamedText: string;
    isStreaming: boolean;
    error: string | null;
}

export interface UseStreamingChatOptions {
    onStateChange?: (state: AgentState, details?: string) => void;
    onToken?: (token: string, fullText: string) => void;
    onComplete?: (response: { text: string; strategy: string }) => void;
    onError?: (error: string) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
    const [state, setState] = useState<StreamingState>({
        agentState: 'idle',
        stateDetails: '',
        streamedText: '',
        isStreaming: false,
        error: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);
    const streamedTextRef = useRef<string>('');

    const sendMessage = useCallback(async (sessionId: string, message: string) => {
        // Abort any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        streamedTextRef.current = '';

        setState({
            agentState: 'listening',
            stateDetails: 'Processing...',
            streamedText: '',
            isStreaming: true,
            error: null,
        });

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sessionId, message }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to start stream');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response stream');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        const event = line.slice(7);
                        const dataLineIdx = lines.indexOf(line) + 1;
                        const dataLine = lines[dataLineIdx];

                        if (dataLine?.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(dataLine.slice(6));
                                handleEvent(event, data);
                            } catch (e) {
                                // Ignore parse errors for partial chunks
                            }
                        }
                    } else if (line.startsWith('data: ')) {
                        // Handle data-only lines (for older SSE format)
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.event) {
                                handleEvent(data.event, data);
                            }
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            }

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                const errorMsg = error.message || 'Stream error';
                setState(prev => ({
                    ...prev,
                    agentState: 'error',
                    stateDetails: errorMsg,
                    isStreaming: false,
                    error: errorMsg,
                }));
                options.onError?.(errorMsg);
            }
        }

        function handleEvent(event: string, data: any) {
            switch (event) {
                case 'state':
                    const agentState = data.state as AgentState;
                    setState(prev => ({
                        ...prev,
                        agentState,
                        stateDetails: data.details || '',
                    }));
                    options.onStateChange?.(agentState, data.details);
                    break;

                case 'token':
                    streamedTextRef.current += data.token;
                    setState(prev => ({
                        ...prev,
                        streamedText: streamedTextRef.current,
                    }));
                    options.onToken?.(data.token, streamedTextRef.current);
                    break;

                case 'done':
                    setState(prev => ({
                        ...prev,
                        agentState: 'complete',
                        stateDetails: 'Complete',
                        isStreaming: false,
                        streamedText: data.text,
                    }));
                    options.onComplete?.(data);
                    break;

                case 'error':
                    setState(prev => ({
                        ...prev,
                        agentState: 'error',
                        stateDetails: data.error,
                        isStreaming: false,
                        error: data.error,
                    }));
                    options.onError?.(data.error);
                    break;
            }
        }

    }, [options]);

    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setState(prev => ({
                ...prev,
                agentState: 'idle',
                isStreaming: false,
            }));
        }
    }, []);

    return {
        ...state,
        sendMessage,
        abort,
    };
}

/**
 * Get human-readable label for agent state
 */
export function getAgentStateLabel(state: AgentState): string {
    switch (state) {
        case 'idle': return 'Ready';
        case 'listening': return 'Listening...';
        case 'understanding': return 'Understanding...';
        case 'checking': return 'Checking safety...';
        case 'recalling': return 'Accessing stories...';
        case 'thinking': return 'Thinking...';
        case 'reasoning': return 'Reasoning...';
        case 'responding': return 'Responding...';
        case 'complete': return 'Done';
        case 'error': return 'Error';
        default: return 'Processing...';
    }
}

/**
 * Get icon name for agent state (Material Symbols)
 */
export function getAgentStateIcon(state: AgentState): string {
    switch (state) {
        case 'idle': return 'mic';
        case 'listening': return 'hearing';
        case 'understanding': return 'psychology';
        case 'checking': return 'shield';
        case 'recalling': return 'accessing';
        case 'thinking': return 'psychology';
        case 'reasoning': return 'lightbulb';
        case 'responding': return 'chat';
        case 'complete': return 'check_circle';
        case 'error': return 'error';
        default: return 'pending';
    }
}
