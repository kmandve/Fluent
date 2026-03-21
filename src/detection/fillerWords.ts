export const FILLER_WORDS = new Set([
  'um',
  'uh',
  'er',
  'ah',
  'like',
  'so',
  'well',
  'you know',
  'i mean',
  'right',
]);

export function endsWithFiller(text: string): boolean {
  const trimmed = text.toLowerCase().trim();
  for (const filler of FILLER_WORDS) {
    if (trimmed === filler || trimmed.endsWith(' ' + filler)) return true;
  }
  return false;
}
