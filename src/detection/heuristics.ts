export const PROLONGATION_STALL_MS = 400;
export const PROLONGATION_ENERGY_FLOOR = 0.025;

/**
 * Detect word/syllable repetitions in interim transcript text.
 * Examines the last 4 tokens; if 2+ consecutive identical tokens trail (or trail before
 * a single different completion word), it's a repetition.
 * Handles patterns like "b b b book" where the final token is the completed word.
 */
export function detectRepetition(
  interimText: string
): { detected: boolean; confidence: number; repeatCount?: number } {
  const tokens = interimText.toLowerCase().trim().split(/[\s\-]+/).filter(Boolean);
  if (tokens.length < 2) return { detected: false, confidence: 0 };

  const tail = tokens.slice(-4);

  // Check 1: trailing consecutive identical tokens (e.g., "b b b b")
  let repeatCount = 1;
  const last = tail[tail.length - 1];
  for (let i = tail.length - 2; i >= 0; i--) {
    if (tail[i] === last) repeatCount++;
    else break;
  }

  if (repeatCount >= 2) {
    // Confidence scales with repeat count: 2 = 0.75, 3 = 0.85, 4+ = 0.92
    const confidence = Math.min(0.92, 0.65 + repeatCount * 0.1);
    return { detected: true, confidence, repeatCount };
  }

  // Check 2: repeated tokens just before the final token (e.g., "the cat b b b book")
  // This handles completed repetitions where the speaker finally said the word.
  if (tail.length >= 3) {
    const secondToLast = tail[tail.length - 2];
    let innerRepeatCount = 1;
    for (let i = tail.length - 3; i >= 0; i--) {
      if (tail[i] === secondToLast) innerRepeatCount++;
      else break;
    }
    if (innerRepeatCount >= 2) {
      const confidence = Math.min(0.92, 0.65 + innerRepeatCount * 0.1);
      return { detected: true, confidence, repeatCount: innerRepeatCount };
    }
  }

  return { detected: false, confidence: 0 };
}

/**
 * Detect prolongations: speech energy present but interim transcript stalled.
 * Prolonged phonemes keep RMS high while the recognizer fails to update.
 */
export function detectProlongation(
  energyLevel: number,
  interimText: string,
  lastInterimText: string,
  lastInterimChangeMs: number,
  now: number
): { detected: boolean; confidence: number; stallDurationMs?: number } {
  const stalled = interimText === lastInterimText;
  const stallDurationMs = stalled ? now - lastInterimChangeMs : 0;
  const hasSpeechEnergy = energyLevel > PROLONGATION_ENERGY_FLOOR;

  if (hasSpeechEnergy && stallDurationMs >= PROLONGATION_STALL_MS) {
    const confidence = Math.min(0.85, 0.60 + (stallDurationMs / 1000) * 0.1);
    return { detected: true, confidence, stallDurationMs };
  }
  return { detected: false, confidence: 0 };
}
