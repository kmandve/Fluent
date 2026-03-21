export interface SpeechOutput {
  speak: (word: string, onEnd?: () => void) => void;
  cancel: () => void;
  prewarm: () => void;
}

export function createSpeechOutput(): SpeechOutput {
  let selectedVoice: SpeechSynthesisVoice | null = null;

  function selectVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    console.debug('[SpeechOutput] Available voices:', voices.length);
    selectedVoice =
      voices.find((v) => v.localService && v.lang.startsWith('en')) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      voices[0] ??
      null;
    if (selectedVoice) {
      console.debug('[SpeechOutput] Selected voice:', selectedVoice.name, selectedVoice.lang);
    }
  }

  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = selectVoice;
  }
  selectVoice();

  function prewarm(): void {
    // No-op — Chrome requires user gesture for first TTS; prewarming
    // with volume=0 can put the synthesis queue in a broken state.
    // The first real speak() call will unlock TTS after the user clicks Start.
  }

  function speak(word: string, onEnd?: () => void): void {
    // Chrome bug: speechSynthesis can get "stuck" in a speaking state.
    // Resume first (no-op if not paused), then cancel to clear the queue.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.85;
    utterance.lang = 'en-US';

    let endCalled = false;
    const safeOnEnd = () => {
      if (endCalled) return;
      endCalled = true;
      onEnd?.();
    };

    utterance.onstart = () => {
      console.debug('[SpeechOutput] TTS started speaking:', word);
    };

    utterance.onend = () => {
      console.debug('[SpeechOutput] TTS finished speaking:', word);
      safeOnEnd();
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      console.warn('[SpeechOutput] TTS error:', e.error, 'word:', word);
      if (e.error !== 'interrupted') {
        safeOnEnd();
      }
    };

    // Safety net: if nothing fires within 1.5s, force the callback
    // so recognition isn't stuck paused forever.
    setTimeout(() => {
      if (!endCalled) {
        console.warn('[SpeechOutput] Safety net triggered (1.5s) for:', word);
        safeOnEnd();
      }
    }, 1500);

    console.debug('[SpeechOutput] Calling speechSynthesis.speak() for:', word);
    window.speechSynthesis.speak(utterance);
  }

  function cancel(): void {
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
  }

  return { speak, cancel, prewarm };
}
