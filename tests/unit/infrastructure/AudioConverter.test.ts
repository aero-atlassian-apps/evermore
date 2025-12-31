
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// 1. Hoist the mock function so it's available for the factory
const { mockSpawn } = vi.hoisted(() => ({
    mockSpawn: vi.fn()
}));

// 2. Mock child_process with named AND default exports
vi.mock('child_process', () => {
    return {
        spawn: mockSpawn,
        default: {
            spawn: mockSpawn
        }
    };
});

// Import after mocking
import { AudioConverter } from '../../../lib/infrastructure/services/AudioConverter';

describe('AudioConverter', () => {
    let converter: AudioConverter;
    let mockChildProcess: any;

    beforeEach(() => {
        converter = new AudioConverter();

        // Setup the mock child process for each test
        mockChildProcess = new EventEmitter();
        (mockChildProcess as any).stdout = new Readable({ read() { } });
        (mockChildProcess as any).stderr = new Readable({ read() { } });
        (mockChildProcess as any).stdin = { write: vi.fn(), end: vi.fn() };

        mockSpawn.mockReturnValue(mockChildProcess);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should detect availability', async () => {
        // Simulate successful version check
        process.nextTick(() => {
            mockChildProcess.emit('close', 0);
        });

        const isAvailable = await converter.isAvailable();
        expect(isAvailable).toBe(true);
        expect(mockSpawn).toHaveBeenCalledWith(expect.stringContaining('ffmpeg'), ['-version']);
    });

    it('should handle missing ffmpeg gracefully', async () => {
        // Simulate availability check failure (e.g. command not found)
        process.nextTick(() => {
            mockChildProcess.emit('error', new Error('spawn ENOENT'));
        });

        const isAvailable = await converter.isAvailable();
        expect(isAvailable).toBe(false);
    });

    it('should convert audio successfully', async () => {
        // Simulate conversion success
        process.nextTick(() => {
            mockChildProcess.stdout.push(Buffer.from('converted-audio'));
            mockChildProcess.stdout.push(null); // End of stream
            mockChildProcess.emit('close', 0);
        });

        const inputBuffer = Buffer.from('test-audio');
        const result = await converter.convert(inputBuffer, 'audio/webm', { targetFormat: 'wav' });

        expect(result).toBeDefined();
        expect(mockSpawn).toHaveBeenCalled();
    });
});
