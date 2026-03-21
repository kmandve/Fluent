import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StutterEvent } from '../detection/types';

// Mock dependencies before importing the module under test
vi.mock('./localPredictor', () => ({
  predict: vi.fn(),
}));

vi.mock('./llmClient', () => ({
  predictNextWord: vi.fn(),
}));

import { predict, resetEngine, LLM_TIMEOUT_MS, LOCAL_CONFIDENCE_THRESHOLD, MIN_CONTEXT_WORDS, MIN_SPEAK_CONFIDENCE } from './predictionEngine';
import { predict as localPredict } from './localPredictor';
import { predictNextWord } from './llmClient';

const mockLocalPredict = vi.mocked(localPredict);
const mockPredictNextWord = vi.mocked(predictNextWord);

// Context with enough words to pass the MIN_CONTEXT_WORDS gate
const ENOUGH_CONTEXT = ['I', 'want', 'to', 'say'];

function makeEvent(id: string = 'evt-1'): StutterEvent {
  return { id, type: 'block', confidence: 0.9, timestamp: Date.now() };
}

describe('predictionEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetEngine();
    mockLocalPredict.mockReturnValue({ word: 'local-word', confidence: 0.8 });
    mockPredictNextWord.mockResolvedValue('llm-word');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns null when context has fewer than MIN_CONTEXT_WORDS', async () => {
    const result = await predict(['I'], makeEvent('evt-short'));
    expect(result).toBeNull();
    expect(mockLocalPredict).not.toHaveBeenCalled();
  });

  it('returns local prediction immediately when confidence >= 0.7 and does not call LLM', async () => {
    mockLocalPredict.mockReturnValue({ word: 'the', confidence: 0.75 });

    const result = await predict(ENOUGH_CONTEXT, makeEvent('evt-1'));

    expect(result).not.toBeNull();
    expect(result!.word).toBe('the');
    expect(result!.source).toBe('local');
    expect(mockPredictNextWord).not.toHaveBeenCalled();
  });

  it('fires LLM when local confidence < 0.7', async () => {
    mockLocalPredict.mockReturnValue({ word: 'fallback', confidence: 0.55 });
    mockPredictNextWord.mockResolvedValue('llm-result');

    const resultPromise = predict(ENOUGH_CONTEXT, makeEvent('evt-2'));
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockPredictNextWord).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result!.word).toBe('llm-result');
    expect(result!.source).toBe('llm');
  });

  it('returns LLM result when it resolves before 200ms timeout', async () => {
    mockLocalPredict.mockReturnValue({ word: 'fallback', confidence: 0.55 });
    mockPredictNextWord.mockResolvedValue('fast-llm');

    const resultPromise = predict(ENOUGH_CONTEXT, makeEvent('evt-3'));
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result!.source).toBe('llm');
    expect(result!.word).toBe('fast-llm');
  });

  it('returns local-fallback when LLM times out AND local confidence >= MIN_SPEAK_CONFIDENCE', async () => {
    mockLocalPredict.mockReturnValue({ word: 'local-backup', confidence: 0.65 });

    mockPredictNextWord.mockImplementation((_words, signal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const resultPromise = predict(ENOUGH_CONTEXT, makeEvent('evt-4'));
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS + 10);
    const result = await resultPromise;

    expect(result!.source).toBe('local-fallback');
    expect(result!.word).toBe('local-backup');
  });

  it('returns null when LLM fails AND local confidence < MIN_SPEAK_CONFIDENCE', async () => {
    mockLocalPredict.mockReturnValue({ word: 'weak-guess', confidence: 0.55 });
    mockPredictNextWord.mockRejectedValue(new Error('Network error'));

    const resultPromise = predict(ENOUGH_CONTEXT, makeEvent('evt-5'));
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBeNull();
  });

  it('sets latencyMs on result', async () => {
    mockLocalPredict.mockReturnValue({ word: 'the', confidence: 0.8 });

    const result = await predict(ENOUGH_CONTEXT, makeEvent('evt-6'));

    expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof result!.latencyMs).toBe('number');
  });

  it('sets triggeredByEventId from event.id', async () => {
    mockLocalPredict.mockReturnValue({ word: 'the', confidence: 0.8 });

    const result = await predict(ENOUGH_CONTEXT, makeEvent('my-event-id'));

    expect(result!.triggeredByEventId).toBe('my-event-id');
  });

  it('returns null for duplicate event ID', async () => {
    mockLocalPredict.mockReturnValue({ word: 'the', confidence: 0.8 });

    const event = makeEvent('dup-id');
    const first = await predict(ENOUGH_CONTEXT, event);
    const second = await predict(ENOUGH_CONTEXT, event);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('resetEngine allows same event ID to be processed again', async () => {
    mockLocalPredict.mockReturnValue({ word: 'the', confidence: 0.8 });

    const event = makeEvent('reset-test');
    await predict(ENOUGH_CONTEXT, event);

    resetEngine();

    const result = await predict(ENOUGH_CONTEXT, event);
    expect(result).not.toBeNull();
    expect(result!.triggeredByEventId).toBe('reset-test');
  });

  it('exports LLM_TIMEOUT_MS = 200', () => {
    expect(LLM_TIMEOUT_MS).toBe(200);
  });

  it('exports LOCAL_CONFIDENCE_THRESHOLD = 0.7', () => {
    expect(LOCAL_CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it('exports MIN_CONTEXT_WORDS = 3', () => {
    expect(MIN_CONTEXT_WORDS).toBe(3);
  });

  it('exports MIN_SPEAK_CONFIDENCE = 0.6', () => {
    expect(MIN_SPEAK_CONFIDENCE).toBe(0.6);
  });
});
