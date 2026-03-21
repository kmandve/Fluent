import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionStore } from '../store/sessionStore';
import type { CaptureManager } from '../audio/captureManager';
import type { PredictionResult } from '../prediction/types';

// Shared mock speech output instance — defined before the vi.mock call so tests
// can inspect calls on the same object the hook receives
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockPrewarm = vi.fn();
const mockSpeechOutputInstance = { speak: mockSpeak, cancel: mockCancel, prewarm: mockPrewarm };

vi.mock('../tts/speechOutput', () => ({
  createSpeechOutput: vi.fn(() => mockSpeechOutputInstance),
}));

// Import the hook AFTER vi.mock so hoisting resolves correctly
import { useTTSOutput } from './useTTSOutput';

function makeCaptureManager(): CaptureManager {
  return {
    start: vi.fn().mockResolvedValue(null),
    stop: vi.fn(),
    isActive: vi.fn().mockReturnValue(true),
    pauseRecognition: vi.fn(),
    resumeRecognition: vi.fn(),
  };
}

function makePrediction(word = 'hello'): PredictionResult {
  return {
    word,
    source: 'local',
    latencyMs: 2,
    triggeredByEventId: 'test-event-id',
  };
}

describe('useTTSOutput', () => {
  let captureManager: CaptureManager;

  beforeEach(() => {
    captureManager = makeCaptureManager();

    // Reset mock call history
    mockSpeak.mockClear();
    mockCancel.mockClear();
    mockPrewarm.mockClear();

    // Reset store to a known state
    useSessionStore.setState({
      isListening: true,
      predictedWord: null,
    });
  });

  afterEach(() => {
    useSessionStore.setState({ isListening: false, predictedWord: null });
    vi.clearAllMocks();
  });

  it('does not call prewarm() on mount (prewarm is no-op)', () => {
    renderHook(() => useTTSOutput(captureManager));
    expect(mockPrewarm).not.toHaveBeenCalled();
  });

  it('calls speak() when predictedWord changes to non-null in store', () => {
    renderHook(() => useTTSOutput(captureManager));

    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('world'));
    });

    expect(mockSpeak).toHaveBeenCalledWith('world', expect.any(Function));
  });

  it('does NOT call speak() when isListening is false', () => {
    useSessionStore.setState({ isListening: false });
    renderHook(() => useTTSOutput(captureManager));

    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('test'));
    });

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('calls clearPredictedWord() immediately when prediction is received (before speaking completes)', () => {
    renderHook(() => useTTSOutput(captureManager));

    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('word'));
    });

    // After the subscription fires, predictedWord should be null (cleared immediately)
    expect(useSessionStore.getState().predictedWord).toBeNull();
  });

  it('calls pauseRecognition() before speak()', () => {
    const callOrder: string[] = [];
    vi.mocked(captureManager.pauseRecognition).mockImplementation(() => {
      callOrder.push('pause');
    });
    mockSpeak.mockImplementation(() => {
      callOrder.push('speak');
    });

    renderHook(() => useTTSOutput(captureManager));

    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('test'));
    });

    expect(callOrder).toEqual(['pause', 'speak']);
  });

  it('calls resumeRecognition() 350ms after utterance onend fires', () => {
    vi.useFakeTimers();

    let onEndCallback: (() => void) | undefined;
    mockSpeak.mockImplementation((_word: string, onEnd: () => void) => {
      onEndCallback = onEnd;
    });

    renderHook(() => useTTSOutput(captureManager));

    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('test'));
    });

    expect(captureManager.resumeRecognition).not.toHaveBeenCalled();

    // Fire utterance onend
    act(() => {
      onEndCallback?.();
    });

    // Not yet — 350ms hasn't elapsed
    expect(captureManager.resumeRecognition).not.toHaveBeenCalled();

    // Advance timers by 350ms
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(captureManager.resumeRecognition).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('does NOT call pauseRecognition() again if already muted (isMutedRef=true)', () => {
    renderHook(() => useTTSOutput(captureManager));

    // First prediction fires - pauses recognition
    act(() => {
      useSessionStore.setState({ isListening: true });
      useSessionStore.getState().setPredictedWord(makePrediction('first'));
    });

    expect(captureManager.pauseRecognition).toHaveBeenCalledTimes(1);

    // Don't fire onEnd yet (still muted) — second prediction fires
    // isMutedRef should be true, so pauseRecognition should NOT be called again
    act(() => {
      useSessionStore.setState({ isListening: true });
      useSessionStore.getState().setPredictedWord(makePrediction('second'));
    });

    // pauseRecognition should still only have been called once
    expect(captureManager.pauseRecognition).toHaveBeenCalledTimes(1);
  });

  it('calls cancel() and cleans up subscription on hook unmount', () => {
    const { unmount } = renderHook(() => useTTSOutput(captureManager));

    act(() => {
      unmount();
    });

    expect(mockCancel).toHaveBeenCalledOnce();
  });

  it('does not call speak() when predictedWord is set to null', () => {
    renderHook(() => useTTSOutput(captureManager));

    // Set a prediction to get a speak call
    act(() => {
      useSessionStore.getState().setPredictedWord(makePrediction('word'));
    });

    const speakCallCount = mockSpeak.mock.calls.length;

    // Clear it explicitly — the hook already cleared it, but a subsequent
    // external clearPredictedWord should not trigger another speak call
    act(() => {
      useSessionStore.getState().clearPredictedWord();
    });

    // No additional speak calls after clearing
    expect(mockSpeak.mock.calls.length).toBe(speakCallCount);
  });
});
