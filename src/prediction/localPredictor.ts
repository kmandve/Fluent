import wordFrequencyList from './data/wordFrequency.json';
import { BIGRAM_INDEX } from './data/bigrams';
import type { LocalPrediction } from './types';

// ─── Name Introduction Override (D-04) ──────────────────────────────────────

const NAME_INTRO_PATTERNS: RegExp[] = [
  /\bmy name is\s*$/i,
  /\bi'm\s*$/i,
  /\bi am\s*$/i,
  /\bname's\s*$/i,
  /\bcall me\s*$/i,
  /\bi go by\s*$/i,
];

const DEMO_SPEAKER_NAME = 'Aadit';

// ─── Confidence Scoring ─────────────────────────────────────────────────────

function bigramConfidence(rank: number): number {
  if (rank <= 1) return 0.85;
  if (rank <= 3) return 0.80;
  if (rank <= 5) return 0.75;
  return 0.65;
}

// ─── Predict ────────────────────────────────────────────────────────────────

/**
 * Synchronous local word predictor. Always returns a result in under 5ms.
 *
 * Priority:
 *   1. Name-introduction override → "Aadit" (confidence 1.0)
 *   2. Bigram lookup → next word based on last word (confidence 0.65–0.85)
 *   3. Unigram fallback → most frequent English word (confidence 0.55)
 */
export function predict(contextWords: string[]): LocalPrediction {
  // Pass 0: Name override (D-04)
  const contextStr = contextWords.join(' ');
  for (const pattern of NAME_INTRO_PATTERNS) {
    if (pattern.test(contextStr)) {
      return { word: DEMO_SPEAKER_NAME, confidence: 1.0 };
    }
  }

  // Pass 1: Bigram lookup
  if (contextWords.length > 0) {
    const lastWord = contextWords[contextWords.length - 1].toLowerCase();
    const successors = BIGRAM_INDEX[lastWord];
    if (successors && successors.length > 0) {
      const best = successors[0];
      return { word: best.word, confidence: bigramConfidence(best.rank) };
    }
  }

  // Pass 2: Unigram fallback (most frequent English word)
  return { word: wordFrequencyList[0], confidence: 0.55 };
}
