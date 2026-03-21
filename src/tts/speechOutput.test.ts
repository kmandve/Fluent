import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpeechOutput } from './speechOutput';

describe('createSpeechOutput', () => {
  let mockSynth: typeof globalThis.speechSynthesis;

  beforeEach(() => {
    mockSynth = globalThis.speechSynthesis;
    vi.mocked(mockSynth.speak).mockClear();
    vi.mocked(mockSynth.cancel).mockClear();
    vi.mocked(mockSynth.getVoices).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns object with speak, cancel, and prewarm methods', () => {
    const output = createSpeechOutput();
    expect(typeof output.speak).toBe('function');
    expect(typeof output.cancel).toBe('function');
    expect(typeof output.prewarm).toBe('function');
  });

  it('speak() calls speechSynthesis.speak() with the word', () => {
    const output = createSpeechOutput();
    output.speak('hello');

    expect(mockSynth.speak).toHaveBeenCalledOnce();
    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.text).toBe('hello');
  });

  it('utterance has rate=1.0, pitch=1.0, volume=1.0, lang="en-US"', () => {
    const output = createSpeechOutput();
    output.speak('test');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.rate).toBe(1.0);
    expect(utterance.pitch).toBe(1.0);
    expect(utterance.volume).toBe(1.0);
    expect(utterance.lang).toBe('en-US');
  });

  it('selects local English voice when available', () => {
    const localEnVoice = {
      name: 'Samantha', lang: 'en-US', localService: true,
      voiceURI: 'samantha', default: true,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([localEnVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(localEnVoice);
  });

  it('prewarm() is a no-op', () => {
    const output = createSpeechOutput();
    output.prewarm();
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it('cancel() calls speechSynthesis.cancel()', () => {
    const output = createSpeechOutput();
    output.cancel();
    expect(mockSynth.cancel).toHaveBeenCalledOnce();
  });

  it('skips speak if already speaking', () => {
    const output = createSpeechOutput();
    const onEnd1 = vi.fn();
    const onEnd2 = vi.fn();

    output.speak('first', onEnd1);
    output.speak('second', onEnd2);

    // Only first speak should go through
    expect(mockSynth.speak).toHaveBeenCalledOnce();
    // Second onEnd called immediately (skipped)
    expect(onEnd2).toHaveBeenCalledOnce();
  });

  it('onEnd fires when utterance.onend fires', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onend();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('onEnd fires on any error (including interrupted)', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onerror({ error: 'interrupted' });
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('onEnd only fires once', () => {
    vi.useFakeTimers();
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onend();
    vi.advanceTimersByTime(3000);

    expect(onEnd).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
