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

    const unsubscribe = useSessionStore.subscribe(
      (state) => state.predictedWord,
      (prediction) => {
        if (!prediction) return;

        // Guard: do not speak if session is stopped
        if (!useSessionStore.getState().isListening) return;

        // Clear immediately to prevent rapid-fire re-triggering
        useSessionStore.getState().clearPredictedWord();

        console.debug('[useTTSOutput] Attempting to speak:', prediction.word, 'source:', prediction.source);

        // Pause recognition for echo prevention
        if (!isMutedRef.current) {
          isMutedRef.current = true;
          captureManager.pauseRecognition();
        }

        // Speak the predicted word
        speechOutput.speak(prediction.word, () => {
          // Resume recognition after utterance ends + tail buffer
          setTimeout(() => {
            if (isMutedRef.current) {
              isMutedRef.current = false;
              captureManager.resumeRecognition();
              console.debug('[useTTSOutput] Recognition resumed');
            }
          }, ECHO_MUTE_TAIL_MS);
        });
      }
    );

    return () => {
      unsubscribe();
      speechOutput.cancel();
      // Always ensure recognition is resumed on cleanup
      if (isMutedRef.current) {
        isMutedRef.current = false;
        captureManager.resumeRecognition();
      }
    };
  }, [captureManager]);
}
