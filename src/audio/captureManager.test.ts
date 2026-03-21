import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCaptureManager } from './captureManager';
import { useSessionStore } from '../store/sessionStore';

// MockSpeechRecognition is set up in tests/setup.ts
// Tests for pauseRecognition() and resumeRecognition()

describe('captureManager pauseRecognition / resumeRecognition', () => {
  let mockStream: MediaStream;
  let lastRecognitionInstance: any;

  beforeEach(() => {
    useSessionStore.getState().resetSession();

    const mockTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    } as unknown as MediaStream;

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    // Spy on SpeechRecognition constructor to capture instance
    const OriginalMock = (globalThis as any).SpeechRecognition;
    const spiedMock = vi.fn().mockImplementation(() => {
      const instance = new OriginalMock();
      lastRecognitionInstance = instance;
      return instance;
    });
    spiedMock.prototype = OriginalMock.prototype;
    vi.stubGlobal('SpeechRecognition', spiedMock);
    vi.stubGlobal('webkitSpeechRecognition', spiedMock);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns an object with pauseRecognition and resumeRecognition methods', () => {
    const manager = createCaptureManager();
    expect(typeof manager.pauseRecognition).toBe('function');
    expect(typeof manager.resumeRecognition).toBe('function');
  });

  it('pauseRecognition() calls recognition.stop() without stopping MediaStream tracks', async () => {
    const manager = createCaptureManager();
    await manager.start();

    const stopSpy = vi.spyOn(lastRecognitionInstance, 'stop');
    const trackStopSpy = (mockStream.getTracks()[0] as any).stop;

    manager.pauseRecognition();

    expect(stopSpy).toHaveBeenCalledOnce();
    expect(trackStopSpy).not.toHaveBeenCalled();
  });

  it('pauseRecognition() suppresses auto-restart in onend handler', async () => {
    const manager = createCaptureManager();
    await manager.start();

    manager.pauseRecognition();

    const startSpy = vi.spyOn(lastRecognitionInstance, 'start');

    // Trigger onend — should NOT auto-restart because paused
    lastRecognitionInstance.onend();
    vi.advanceTimersByTime(200);

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('resumeRecognition() calls recognition.start() and re-enables auto-restart', async () => {
    const manager = createCaptureManager();
    await manager.start();

    manager.pauseRecognition();

    const startSpy = vi.spyOn(lastRecognitionInstance, 'start');

    manager.resumeRecognition();

    expect(startSpy).toHaveBeenCalledOnce();
  });

  it('after resumeRecognition(), onend DOES trigger auto-restart (normal behavior restored)', async () => {
    const manager = createCaptureManager();
    await manager.start();

    manager.pauseRecognition();
    manager.resumeRecognition();

    const startSpy = vi.spyOn(lastRecognitionInstance, 'start');

    // Trigger onend — should auto-restart now
    lastRecognitionInstance.onend();
    vi.advanceTimersByTime(200);

    expect(startSpy).toHaveBeenCalledOnce();
  });

  it('pauseRecognition() when already paused is a no-op (no double-stop)', async () => {
    const manager = createCaptureManager();
    await manager.start();

    const stopSpy = vi.spyOn(lastRecognitionInstance, 'stop');

    manager.pauseRecognition();
    manager.pauseRecognition(); // second call should be no-op

    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('resumeRecognition() when not paused is a no-op (no double-start)', async () => {
    const manager = createCaptureManager();
    await manager.start();

    const startSpy = vi.spyOn(lastRecognitionInstance, 'start');

    // Not paused — resumeRecognition should be a no-op
    manager.resumeRecognition();

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('mediaStream tracks remain active after pauseRecognition() and resumeRecognition()', async () => {
    const manager = createCaptureManager();
    await manager.start();

    const trackStopSpy = (mockStream.getTracks()[0] as any).stop;

    manager.pauseRecognition();
    manager.resumeRecognition();

    expect(trackStopSpy).not.toHaveBeenCalled();
  });
});
