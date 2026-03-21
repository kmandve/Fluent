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

    utterance.onend = () => {
      onEnd?.();
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (e.error !== 'interrupted') {
        console.warn('[SpeechOutput] TTS error:', e.error);
        onEnd?.();
      }
      // 'interrupted' errors are expected from cancel() — do NOT call onEnd
    };

    window.speechSynthesis.speak(utterance);
  }

  function cancel(): void {
    window.speechSynthesis.cancel();
  }

  return { speak, cancel, prewarm };
}
