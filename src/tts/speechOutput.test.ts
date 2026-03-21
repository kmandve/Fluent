import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpeechOutput } from './speechOutput';

// SpeechSynthesis mocks are set up in tests/setup.ts

describe('createSpeechOutput', () => {
  let mockSynth: typeof globalThis.speechSynthesis;

  beforeEach(() => {
    mockSynth = globalThis.speechSynthesis;

    // Reset mocks before each test
    vi.mocked(mockSynth.speak).mockClear();
    vi.mocked(mockSynth.cancel).mockClear();
    vi.mocked(mockSynth.resume).mockClear();
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

  it('speak() calls resume then cancel then speak', () => {
    const output = createSpeechOutput();
    const callOrder: string[] = [];

    vi.mocked(mockSynth.resume).mockImplementation(() => { callOrder.push('resume'); });
    vi.mocked(mockSynth.cancel).mockImplementation(() => { callOrder.push('cancel'); });
    vi.mocked(mockSynth.speak).mockImplementation(() => { callOrder.push('speak'); });

    output.speak('hello');

    expect(callOrder).toEqual(['resume', 'cancel', 'speak']);
  });

  it('speak() creates utterance with the word', () => {
    const output = createSpeechOutput();
    output.speak('hello');

    expect(mockSynth.speak).toHaveBeenCalledOnce();
    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.text).toBe('hello');
  });

  it('utterance has rate=1.0, pitch=1.0, volume=0.85, lang="en-US"', () => {
    const output = createSpeechOutput();
    output.speak('test');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.rate).toBe(1.0);
    expect(utterance.pitch).toBe(1.0);
    expect(utterance.volume).toBe(0.85);
    expect(utterance.lang).toBe('en-US');
  });

  it('selects local English voice when available', () => {
    const localEnVoice = {
      name: 'Samantha', lang: 'en-US', localService: true,
      voiceURI: 'samantha', default: true,
    } as SpeechSynthesisVoice;

    const remoteVoice = {
      name: 'Google US English', lang: 'en-US', localService: false,
      voiceURI: 'google', default: false,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([remoteVoice, localEnVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(localEnVoice);
  });

  it('falls back to any English voice when no local English voice exists', () => {
    const nonLocalEnVoice = {
      name: 'Google US English', lang: 'en-US', localService: false,
      voiceURI: 'google', default: false,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([nonLocalEnVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(nonLocalEnVoice);
  });

  it('prewarm() is a no-op (does not call speechSynthesis.speak)', () => {
    const output = createSpeechOutput();
    output.prewarm();

    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it('cancel() calls resume then cancel', () => {
    const output = createSpeechOutput();
    output.cancel();

    expect(mockSynth.resume).toHaveBeenCalled();
    expect(mockSynth.cancel).toHaveBeenCalled();
  });

  it('onEnd callback fires when utterance.onend fires', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(onEnd).not.toHaveBeenCalled();

    utterance.onend();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('onEnd only fires once even if both onend and safety net trigger', () => {
    vi.useFakeTimers();
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onend();
    vi.advanceTimersByTime(2000);

    expect(onEnd).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('onerror with "interrupted" does NOT call onEnd', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onerror({ error: 'interrupted' });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('onerror with real error DOES call onEnd', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    utterance.onerror({ error: 'synthesis-failed' });
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
