import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAcousticAnalyzer } from '../src/audio/acousticAnalyzer';

// MockAudioContext is set up in tests/setup.ts
// It provides a mock analyser with getFloatTimeDomainData that fills buffer with zeros

describe('createAcousticAnalyzer', () => {
  let mockStream: MediaStream;

  beforeEach(() => {
    // Create a minimal mock MediaStream
    mockStream = {} as MediaStream;
    vi.clearAllMocks();
  });

  it('returns an object with getRMS and stop methods', () => {
    const analyzer = createAcousticAnalyzer(mockStream);
    expect(typeof analyzer.getRMS).toBe('function');
    expect(typeof analyzer.stop).toBe('function');
  });

  it('getRMS returns 0 for a silent buffer (all zeros)', () => {
    // Default mock fills buffer with 0 — silent signal
    const analyzer = createAcousticAnalyzer(mockStream);
    const rms = analyzer.getRMS();
    expect(rms).toBe(0);
  });

  it('getRMS returns correct RMS for known values', () => {
    // Override getFloatTimeDomainData to fill with a constant value of 1.0
    // RMS of buffer all-ones: sqrt(sum(1^2) / N) = sqrt(N/N) = sqrt(1) = 1.0
    const mockAnalyser = {
      fftSize: 4,
      getFloatTimeDomainData: (buffer: Float32Array) => {
        buffer.fill(1.0);
      },
      connect: vi.fn(),
    };
    const mockAudioCtx = {
      createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      close: vi.fn(),
    };
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockAudioCtx));

    const analyzer = createAcousticAnalyzer(mockStream);
    const rms = analyzer.getRMS();
    // All samples are 1.0 → sum of squares = N → RMS = 1.0
    expect(rms).toBeCloseTo(1.0, 5);

    vi.unstubAllGlobals();
  });

  it('getRMS returns ~0.707 for a full-scale sine wave approximation', () => {
    // A half sine wave approximation: fill half buffer with 1.0, half with -1.0
    // RMS of alternating +1/-1: sqrt(sum(1) / N) = 1.0
    // For true sine RMS = A/sqrt(2) ≈ 0.707 for amplitude=1
    // Test with a known constant to verify math formula
    const value = Math.SQRT1_2; // ~0.707
    const mockAnalyser = {
      fftSize: 256,
      getFloatTimeDomainData: (buffer: Float32Array) => {
        // Fill with value such that RMS = value
        // RMS = sqrt(sum(v^2) / N) = v (since all values same)
        buffer.fill(value);
      },
      connect: vi.fn(),
    };
    const mockAudioCtx = {
      createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      close: vi.fn(),
    };
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockAudioCtx));

    const analyzer = createAcousticAnalyzer(mockStream);
    const rms = analyzer.getRMS();
    expect(rms).toBeCloseTo(value, 5);

    vi.unstubAllGlobals();
  });

  it('stop() calls audioCtx.close()', () => {
    const mockClose = vi.fn();
    const mockAudioCtx = {
      createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        getFloatTimeDomainData: (buffer: Float32Array) => buffer.fill(0),
        connect: vi.fn(),
      }),
      close: mockClose,
    };
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => mockAudioCtx));

    const analyzer = createAcousticAnalyzer(mockStream);
    analyzer.stop();
    expect(mockClose).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});
