import type { TranscriptEntry } from '../store/sessionStore';

/**
 * Extract the last N words from rolling transcript + interimText.
 * Returns a scaffolding array if no speech context is available.
 */
export function buildContext(
  state: { transcript: TranscriptEntry[]; interimText: string },
  windowWords = 8
): string[] {
  const allText = [
    ...state.transcript.map((e) => e.text),
    state.interimText,
  ]
    .join(' ')
    .trim();

  if (!allText) {
    return ['The', 'speaker', 'is', 'saying'];
  }

  const words = allText.split(/\s+/).filter(Boolean);
  return words.slice(-windowWords);
}
