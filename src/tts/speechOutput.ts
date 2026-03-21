export interface SpeechOutput {
  speak: (word: string, onEnd?: () => void) => void;
  cancel: () => void;
  prewarm: () => void;
}

export function createSpeechOutput(): SpeechOutput {
  let selectedVoice: SpeechSynthesisVoice | null = null;

  function selectVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    selectedVoice =
      voices.find((v) => v.localService && v.lang.startsWith('en')) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      voices[0] ??
      null;
  }

  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = selectVoice;
  }
  selectVoice();

  function prewarm(): void {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  function speak(word: string, onEnd?: () => void): void {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 0.75;
    utterance.lang = 'en-US';

    let endCalled = false;
    const safeOnEnd = () => {
      if (endCalled) return;
      endCalled = true;
      onEnd?.();
    };

    utterance.onend = () => {
      safeOnEnd();
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (e.error !== 'interrupted') {
        console.warn('[SpeechOutput] TTS error:', e.error);
        safeOnEnd();
      }
      // 'interrupted' errors are expected from cancel() — do NOT call onEnd
    };

    // Safety net: Chrome sometimes doesn't fire onend for short utterances.
    // Always resume recognition after 3 seconds max, even if onend never fires.
    setTimeout(() => {
      if (!endCalled) {
        console.warn('[SpeechOutput] Safety net: onend did not fire within 3s, forcing callback');
        safeOnEnd();
      }
    }, 3000);

    window.speechSynthesis.speak(utterance);
  }

  function cancel(): void {
    window.speechSynthesis.cancel();
  }

  return { speak, cancel, prewarm };
}
