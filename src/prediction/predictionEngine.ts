import { predict as localPredict } from './localPredictor';
import { predictNextWord } from './llmClient';
import type { PredictionResult } from './types';
import type { StutterEvent } from '../detection/types';

export const LLM_TIMEOUT_MS = 200;
export const LOCAL_CONFIDENCE_THRESHOLD = 0.7;

// Module-level duplicate guard — tracks the last processed event ID
let lastProcessedEventId: string | null = null;

/**
 * Orchestrates prediction: local-first, LLM fallback with 200ms hard timeout.
 *
 * Pipeline:
 *   1. Run local predictor (synchronous, <5ms)
 *   2. If local confidence >= 0.7 → return immediately (source: 'local')
 *   3. Otherwise → fire LLM with 200ms AbortController timeout
 *      - LLM resolves in time → return with source: 'llm'
 *      - LLM times out or throws → return local prediction (source: 'local-fallback')
 *
 * @param contextWords - Recent speech context words
 * @param event - The stutter event that triggered this prediction
 * @returns PredictionResult or null if event is a duplicate
 */
export async function predict(
  contextWords: string[],
  event: StutterEvent
): Promise<PredictionResult | null> {
  // Duplicate event guard — prevents double-trigger for same detection event
  if (event.id === lastProcessedEventId) {
    return null;
  }
  lastProcessedEventId = event.id;

  const t0 = performance.now();
  const local = localPredict(contextWords);

  if (local.confidence >= LOCAL_CONFIDENCE_THRESHOLD) {
    return {
      word: local.word,
      source: 'local',
      latencyMs: performance.now() - t0,
      triggeredByEventId: event.id,
    };
  }

  // Local confidence too low — try LLM with hard timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const word = await predictNextWord(contextWords, controller.signal);
    clearTimeout(timeoutId);
    return {
      word,
      source: 'llm',
      latencyMs: performance.now() - t0,
      triggeredByEventId: event.id,
    };
  } catch {
    clearTimeout(timeoutId);
    // LLM timed out or failed — use local prediction as safety net
    return {
      word: local.word,
      source: 'local-fallback',
      latencyMs: performance.now() - t0,
      triggeredByEventId: event.id,
    };
  }
}

/**
 * Reset engine state — clears the duplicate event guard.
 * Call this when listening stops or session resets.
 */
export function resetEngine(): void {
  lastProcessedEventId = null;
}
