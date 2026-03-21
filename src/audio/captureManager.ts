import { useSessionStore } from '../store/sessionStore';

const MAX_RESTART_ATTEMPTS = 10;

export interface CaptureManager {
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  isActive: () => boolean;
}

export function createCaptureManager(): CaptureManager {
  const RecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const recognition: SpeechRecognition = new RecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let isListening = false;
  let restartAttempts = 0;
  let mediaStream: MediaStream | null = null;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    // Reset restart counter on successful speech detection
    restartAttempts = 0;

    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        finalTranscript += text;
      } else {
        interimTranscript += text;
      }
    }

    if (finalTranscript) {
      useSessionStore.getState().addFinalTranscript(finalTranscript);
    }
    useSessionStore.getState().setInterimText(interimTranscript);
  };

  recognition.onend = () => {
    if (isListening && restartAttempts < MAX_RESTART_ATTEMPTS) {
      restartAttempts++;
      setTimeout(() => {
        try {
          recognition.start();
        } catch (_e) {
          // Already started — ignore
        }
      }, 100);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === 'no-speech') {
      // Chrome sends this before onend; onend handler will restart
      return;
    }
    if (event.error === 'not-allowed') {
      isListening = false;
      useSessionStore.getState().setErrorState('mic-denied');
    }
  };

  async function start(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStream = stream;
      isListening = true;
      restartAttempts = 0;

      try {
        recognition.start();
      } catch (_e) {
        // Ignore start errors (already started)
      }

      return stream;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        useSessionStore.getState().setErrorState('mic-denied');
      }
      return null;
    }
  }

  function stop(): void {
    isListening = false;
    recognition.stop();
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  function isActive(): boolean {
    return isListening;
  }

  return { start, stop, isActive };
}
