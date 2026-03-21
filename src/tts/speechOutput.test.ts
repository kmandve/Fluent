import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpeechOutput } from './speechOutput';

// SpeechSynthesis mocks are set up in tests/setup.ts

describe('createSpeechOutput', () => {
  let mockSynth: typeof globalThis.speechSynthesis;
  let MockUtterance: typeof SpeechSynthesisUtterance;

  beforeEach(() => {
    mockSynth = globalThis.speechSynthesis;
    MockUtterance = globalThis.SpeechSynthesisUtterance;

    // Reset mocks before each test
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

  it('speak() calls speechSynthesis.cancel() before speechSynthesis.speak()', () => {
    const output = createSpeechOutput();
    const callOrder: string[] = [];

    vi.mocked(mockSynth.cancel).mockImplementation(() => {
      callOrder.push('cancel');
    });
    vi.mocked(mockSynth.speak).mockImplementation(() => {
      callOrder.push('speak');
    });

    output.speak('hello');

    expect(callOrder).toEqual(['cancel', 'speak']);
    expect(mockSynth.cancel).toHaveBeenCalled();
    expect(mockSynth.speak).toHaveBeenCalled();
  });

  it('speak() calls speechSynthesis.speak() with a SpeechSynthesisUtterance containing the word', () => {
    const output = createSpeechOutput();
    output.speak('hello');

    expect(mockSynth.speak).toHaveBeenCalledOnce();
    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.text).toBe('hello');
  });

  it('utterance has rate=1.1, pitch=1.0, volume=0.75, lang="en-US"', () => {
    const output = createSpeechOutput();
    output.speak('test');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.rate).toBe(1.1);
    expect(utterance.pitch).toBe(1.0);
    expect(utterance.volume).toBe(0.75);
    expect(utterance.lang).toBe('en-US');
  });

  it('speak() selects local English voice when available', () => {
    const localEnVoice = {
      name: 'Samantha',
      lang: 'en-US',
      localService: true,
      voiceURI: 'com.apple.speech.synthesis.voice.samantha',
      default: true,
    } as SpeechSynthesisVoice;

    const remoteVoice = {
      name: 'Google US English',
      lang: 'en-US',
      localService: false,
      voiceURI: 'Google US English',
      default: false,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([remoteVoice, localEnVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(localEnVoice);
  });

  it('speak() falls back to any English voice when no local English voice exists', () => {
    const nonLocalEnVoice = {
      name: 'Google US English',
      lang: 'en-US',
      localService: false,
      voiceURI: 'Google US English',
      default: false,
    } as SpeechSynthesisVoice;

    const frenchVoice = {
      name: 'French Voice',
      lang: 'fr-FR',
      localService: true,
      voiceURI: 'fr-voice',
      default: false,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([frenchVoice, nonLocalEnVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(nonLocalEnVoice);
  });

  it('speak() falls back to voices[0] when no English voice exists', () => {
    const frenchVoice = {
      name: 'French Voice',
      lang: 'fr-FR',
      localService: true,
      voiceURI: 'fr-voice',
      default: false,
    } as SpeechSynthesisVoice;

    vi.mocked(mockSynth.getVoices).mockReturnValue([frenchVoice]);

    const output = createSpeechOutput();
    output.speak('word');

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBe(frenchVoice);
  });

  it('speak() with null selectedVoice (no voices available) still calls speechSynthesis.speak()', () => {
    vi.mocked(mockSynth.getVoices).mockReturnValue([]);

    const output = createSpeechOutput();
    output.speak('hello');

    expect(mockSynth.speak).toHaveBeenCalledOnce();
    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.voice).toBeNull();
  });

  it('cancel() calls speechSynthesis.cancel()', () => {
    const output = createSpeechOutput();
    output.cancel();

    expect(mockSynth.cancel).toHaveBeenCalledOnce();
  });

  it('prewarm() calls speechSynthesis.speak() with volume=0 utterance', () => {
    const output = createSpeechOutput();
    output.prewarm();

    expect(mockSynth.speak).toHaveBeenCalledOnce();
    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(utterance.volume).toBe(0);
  });

  it('speak() with onEnd callback — onEnd is called when utterance.onend fires', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;
    expect(onEnd).not.toHaveBeenCalled();

    // Simulate onend firing
    utterance.onend();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('onerror with error="interrupted" does NOT call onEnd', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;

    // Simulate interrupted error (from cancel())
    utterance.onerror({ error: 'interrupted' });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('onerror with error="synthesis-failed" DOES call onEnd (real errors resume)', () => {
    const output = createSpeechOutput();
    const onEnd = vi.fn();

    output.speak('hello', onEnd);

    const utterance = vi.mocked(mockSynth.speak).mock.calls[0][0] as any;

    // Simulate real error
    utterance.onerror({ error: 'synthesis-failed' });
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
