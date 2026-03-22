import { useSessionStore } from '../store/sessionStore';

const MAX_RESTART_ATTEMPTS = 10;

export interface CaptureManager {
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  isActive: () => boolean;
  pauseRecognition: () => void;
  resumeRecognition: () => void;
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
  let recognitionPaused = false;

  recognition.onstart = () => {
    console.debug('[captureManager] SpeechRecognition started');
  };

  recognition.onaudiostart = () => {
    console.debug('[captureManager] Audio capture started');
  };

  recognition.onspeechstart = () => {
    console.debug('[captureManager] Speech detected');
  };

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

    console.debug('[captureManager] result:', { finalTranscript, interimTranscript });

    if (finalTranscript) {
      useSessionStore.getState().addFinalTranscript(finalTranscript);
    }
    useSessionStore.getState().setInterimText(interimTranscript);
  };

  recognition.onend = () => {
    console.debug('[captureManager] SpeechRecognition ended, isListening:', isListening, 'paused:', recognitionPaused);
    if (isListening && !recognitionPaused && restartAttempts < MAX_RESTART_ATTEMPTS) {
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
    console.warn('[captureManager] SpeechRecognition error:', event.error, event.message);
    if (event.error === 'no-speech') {
      // Chrome sends this before onend; onend handler will restart
      return;
    }
    if (event.error === 'not-allowed') {
      isListening = false;
      useSessionStore.getState().setErrorState('mic-denied');
    }
    if (event.error === 'audio-capture') {
      console.error('[captureManager] Audio capture failed — mic may be locked by another process');
    }
    if (event.error === 'network') {
      console.error('[captureManager] Network error — Chrome Web Speech API requires internet');
    }
  };

  async function start(): Promise<MediaStream | null> {
    try {
      // Start recognition first — it opens its own internal mic channel
      isListening = true;
      restartAttempts = 0;

      try {
        recognition.start();
        console.debug('[captureManager] recognition.start() called');
      } catch (_e) {
        console.warn('[captureManager] recognition.start() threw:', _e);
      }

      // Then get getUserMedia stream — use selected mic if set
      const selectedMicId = useSessionStore.getState().selectedMicId;
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {}),
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      mediaStream = stream;
      console.debug('[captureManager] getUserMedia stream obtained');

      return stream;
    } catch (err) {
      isListening = false;
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        useSessionStore.getState().setErrorState('mic-denied');
      }
      console.error('[captureManager] start failed:', err);
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

  function pauseRecognition(): void {
    if (recognitionPaused) return; // Already paused — no-op
    recognitionPaused = true;
    recognition.stop(); // Stop recognition only — mediaStream stays alive
    console.debug('[captureManager] Recognition paused (MediaStream still active)');
  }

  function resumeRecognition(): void {
    if (!recognitionPaused) return; // Not paused — no-op
    recognitionPaused = false;
    restartAttempts = 0;
    try {
      recognition.start();
      console.debug('[captureManager] Recognition resumed');
    } catch (_e) {
      console.warn('[captureManager] Recognition resume threw:', _e);
    }
  }

  return { start, stop, isActive, pauseRecognition, resumeRecognition };
}
