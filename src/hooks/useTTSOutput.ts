import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { createSpeechOutput } from '../tts/speechOutput';
import type { CaptureManager } from '../audio/captureManager';

const ECHO_MUTE_TAIL_MS = 350;

export function useTTSOutput(captureManager: CaptureManager): void {
  const speechOutputRef = useRef(createSpeechOutput());
  const isMutedRef = useRef(false);

  useEffect(() => {
    const speechOutput = speechOutputRef.current;

    // Prewarm TTS audio pipeline on first mount to eliminate cold-start latency
    speechOutput.prewarm();

    const unsubscribe = useSessionStore.subscribe(
      (state) => state.predictedWord,
      (prediction) => {
        if (!prediction) return;

        // Guard: do not speak if session is stopped
        if (!useSessionStore.getState().isListening) return;

        // Clear immediately to prevent rapid-fire re-triggering
        useSessionStore.getState().clearPredictedWord();

        // Echo prevention: pause recognition before speaking
        if (!isMutedRef.current) {
          isMutedRef.current = true;
          captureManager.pauseRecognition();
        }

        // Speak the predicted word (cancel-before-speak is inside speechOutput.speak)
        speechOutput.speak(prediction.word, () => {
          // Resume recognition after utterance ends + tail buffer
          setTimeout(() => {
            isMutedRef.current = false;
            captureManager.resumeRecognition();
          }, ECHO_MUTE_TAIL_MS);
        });

        console.debug('[useTTSOutput] Speaking:', prediction.word, 'source:', prediction.source);
      }
    );

    return () => {
      unsubscribe();
      speechOutput.cancel();
    };
  }, [captureManager]);
}
