export interface SpeechOutput {
  speak: (word: string, onEnd?: () => void) => void;
  cancel: () => void;
  prewarm: () => void;
}

export function createSpeechOutput(): SpeechOutput {
  let selectedVoice: SpeechSynthesisVoice | null = null;
  let isSpeaking = false;

  function selectVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    selectedVoice =
      voices.find((v) => v.localService && v.lang.startsWith('en')) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      voices[0] ??
      null;
    if (selectedVoice) {
      console.debug('[SpeechOutput] Voice:', selectedVoice.name);
    }
  }

  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = selectVoice;
  }
  selectVoice();

  function prewarm(): void {
    // No-op
  }

  function speak(word: string, onEnd?: () => void): void {
    // If already speaking, skip this prediction entirely.
    // Do NOT cancel — Chrome's cancel() kills the next speak() too.
    if (isSpeaking) {
      console.debug('[SpeechOutput] Already speaking, skipping:', word);
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    let endCalled = false;
    const safeOnEnd = () => {
      if (endCalled) return;
      endCalled = true;
      isSpeaking = false;
      onEnd?.();
    };

    utterance.onstart = () => {
      console.debug('[SpeechOutput] Speaking:', word);
    };

    utterance.onend = () => {
      safeOnEnd();
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      console.warn('[SpeechOutput] Error:', e.error);
      safeOnEnd();
    };

    // Safety net — always recover within 2s
    setTimeout(() => {
      if (!endCalled) {
        console.warn('[SpeechOutput] Safety net for:', word);
        safeOnEnd();
      }
    }, 2000);

    isSpeaking = true;
    window.speechSynthesis.speak(utterance);
  }

  function cancel(): void {
    isSpeaking = false;
    window.speechSynthesis.cancel();
  }

  return { speak, cancel, prewarm };
}
