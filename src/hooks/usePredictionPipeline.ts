import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { predict, resetEngine } from '../prediction/predictionEngine';
import { buildContext } from '../prediction/contextBuilder';

/**
 * React hook that wires stutter detection events to the prediction pipeline.
 *
 * When a new detection event fires (via lastDetection in the store):
 *   1. Builds context from rolling transcript + interim text
 *   2. Calls predict() — local-first, LLM fallback with 200ms timeout
 *   3. Writes PredictionResult to store via setPredictedWord
 *
 * Resets the prediction engine when listening stops.
 */
export function usePredictionPipeline(): void {
  const lastProcessedIdRef = useRef<string | null>(null);
  const isListening = useSessionStore((s) => s.isListening);

  useEffect(() => {
    if (!isListening) {
      resetEngine();
      return;
    }

    const unsubscribe = useSessionStore.subscribe(
      (state) => state.lastDetection,
      async (detection) => {
        // No detection or already processed this event
        if (!detection || detection.id === lastProcessedIdRef.current) {
          return;
        }

        lastProcessedIdRef.current = detection.id;

        // Build context from current store snapshot
        const state = useSessionStore.getState();
        const context = buildContext(state);

        // Run prediction pipeline
        const result = await predict(context, detection);
        if (result !== null) {
          useSessionStore.getState().setPredictedWord(result);
          console.debug(
            '[Prediction]',
            result.source,
            result.word,
            result.latencyMs.toFixed(1) + 'ms'
          );
        }
      }
    );

    return unsubscribe;
  }, [isListening]);
}
