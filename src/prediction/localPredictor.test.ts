import { describe, it, expect } from 'vitest';
import { predict } from './localPredictor';
import { buildContext } from './contextBuilder';
import type { TranscriptEntry } from '../store/sessionStore';

function makeEntry(text: string): TranscriptEntry {
  return { id: crypto.randomUUID(), text, isFinal: true, timestamp: Date.now() };
}

describe('buildContext', () => {
  it('extracts last N words from transcript + interimText', () => {
    const result = buildContext({
      transcript: [makeEntry('hello world'), makeEntry('my name')],
      interimText: 'is',
    });
    expect(result).toEqual(['hello', 'world', 'my', 'name', 'is']);
  });

  it('returns scaffolding for empty input', () => {
    const result = buildContext({ transcript: [], interimText: '' });
    expect(result).toEqual(['The', 'speaker', 'is', 'saying']);
  });

  it('returns only last windowWords words', () => {
    const longText = 'one two three four five six seven eight nine ten eleven twelve';
    const result = buildContext({ transcript: [makeEntry(longText)], interimText: '' }, 8);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('five');
    expect(result[7]).toBe('twelve');
  });

  it('respects custom windowWords parameter', () => {
    const result = buildContext(
      { transcript: [makeEntry('a b c d e f')], interimText: '' },
      3
    );
    expect(result).toEqual(['d', 'e', 'f']);
  });
});

describe('predict', () => {
  it('returns "Aadit" for "my name is" context', () => {
    const result = predict(['my', 'name', 'is']);
    expect(result.word).toBe('Aadit');
    expect(result.confidence).toBe(1.0);
  });

  it('returns "Aadit" for "I\'m" context', () => {
    const result = predict(["I'm"]);
    expect(result.word).toBe('Aadit');
    expect(result.confidence).toBe(1.0);
  });

  it('returns "Aadit" for "I am" context', () => {
    const result = predict(['I', 'am']);
    expect(result.word).toBe('Aadit');
    expect(result.confidence).toBe(1.0);
  });

  it('name override is case-insensitive', () => {
    const result = predict(['MY', 'NAME', 'IS']);
    expect(result.word).toBe('Aadit');
    expect(result.confidence).toBe(1.0);
  });

  it('returns "Aadit" for "call me" context', () => {
    const result = predict(['call', 'me']);
    expect(result.word).toBe('Aadit');
    expect(result.confidence).toBe(1.0);
  });

  it('returns bigram match with confidence >= 0.75 for top-ranked successor', () => {
    const result = predict(['I', 'have']);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.word).toBeTruthy();
  });

  it('returns unigram fallback for unknown context', () => {
    const result = predict(['xyznonexistent']);
    expect(result.confidence).toBe(0.55);
    expect(result.word).toBeTruthy();
  });

  it('always returns non-empty word string', () => {
    const result = predict([]);
    expect(result.word).toBeTruthy();
    expect(typeof result.word).toBe('string');
  });

  it('empty input returns unigram fallback (never throws)', () => {
    expect(() => predict([])).not.toThrow();
    const result = predict([]);
    expect(result.confidence).toBe(0.55);
  });

  it('completes in under 5ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      predict(['I', 'have', 'been', 'working', 'on', 'this', 'for', 'a']);
    }
    const elapsed = (performance.now() - start) / 100;
    expect(elapsed).toBeLessThan(5);
  });
});
