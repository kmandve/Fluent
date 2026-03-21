/**
 * Common English bigram index — maps a word to its most likely successors.
 * Hand-curated from common English word pair frequencies.
 * Used by localPredictor for context-aware word prediction.
 */
export const BIGRAM_INDEX: Record<string, Array<{ word: string; rank: number }>> = {
  i: [
    { word: 'am', rank: 1 }, { word: 'have', rank: 2 }, { word: 'was', rank: 3 },
    { word: 'will', rank: 4 }, { word: 'can', rank: 5 }, { word: 'think', rank: 6 },
    { word: 'want', rank: 7 }, { word: 'need', rank: 8 }, { word: 'know', rank: 9 },
    { word: 'like', rank: 10 },
  ],
  my: [
    { word: 'name', rank: 1 }, { word: 'own', rank: 2 }, { word: 'first', rank: 3 },
    { word: 'life', rank: 4 }, { word: 'friend', rank: 5 }, { word: 'family', rank: 6 },
  ],
  the: [
    { word: 'same', rank: 1 }, { word: 'first', rank: 2 }, { word: 'most', rank: 3 },
    { word: 'best', rank: 4 }, { word: 'other', rank: 5 }, { word: 'next', rank: 6 },
    { word: 'last', rank: 7 }, { word: 'new', rank: 8 },
  ],
  is: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'not', rank: 3 },
    { word: 'that', rank: 4 }, { word: 'very', rank: 5 }, { word: 'really', rank: 6 },
  ],
  to: [
    { word: 'be', rank: 1 }, { word: 'the', rank: 2 }, { word: 'do', rank: 3 },
    { word: 'have', rank: 4 }, { word: 'get', rank: 5 }, { word: 'make', rank: 6 },
    { word: 'say', rank: 7 }, { word: 'go', rank: 8 },
  ],
  have: [
    { word: 'a', rank: 1 }, { word: 'been', rank: 2 }, { word: 'to', rank: 3 },
    { word: 'the', rank: 4 }, { word: 'no', rank: 5 },
  ],
  in: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'this', rank: 3 },
    { word: 'my', rank: 4 }, { word: 'order', rank: 5 },
  ],
  it: [
    { word: 'is', rank: 1 }, { word: 'was', rank: 2 }, { word: 'would', rank: 3 },
    { word: 'can', rank: 4 }, { word: 'will', rank: 5 },
  ],
  that: [
    { word: 'the', rank: 1 }, { word: 'is', rank: 2 }, { word: 'was', rank: 3 },
    { word: 'I', rank: 4 }, { word: 'we', rank: 5 },
  ],
  was: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'not', rank: 3 },
    { word: 'very', rank: 4 }, { word: 'going', rank: 5 },
  ],
  for: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'me', rank: 3 },
    { word: 'you', rank: 4 }, { word: 'this', rank: 5 },
  ],
  on: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'my', rank: 3 },
    { word: 'this', rank: 4 },
  ],
  are: [
    { word: 'the', rank: 1 }, { word: 'not', rank: 2 }, { word: 'you', rank: 3 },
    { word: 'a', rank: 4 }, { word: 'very', rank: 5 },
  ],
  with: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'my', rank: 3 },
    { word: 'this', rank: 4 },
  ],
  this: [
    { word: 'is', rank: 1 }, { word: 'was', rank: 2 }, { word: 'will', rank: 3 },
    { word: 'can', rank: 4 },
  ],
  you: [
    { word: 'can', rank: 1 }, { word: 'are', rank: 2 }, { word: 'have', rank: 3 },
    { word: 'know', rank: 4 }, { word: 'want', rank: 5 },
  ],
  we: [
    { word: 'are', rank: 1 }, { word: 'have', rank: 2 }, { word: 'can', rank: 3 },
    { word: 'will', rank: 4 }, { word: 'need', rank: 5 },
  ],
  he: [
    { word: 'is', rank: 1 }, { word: 'was', rank: 2 }, { word: 'has', rank: 3 },
    { word: 'will', rank: 4 }, { word: 'said', rank: 5 },
  ],
  she: [
    { word: 'is', rank: 1 }, { word: 'was', rank: 2 }, { word: 'has', rank: 3 },
    { word: 'will', rank: 4 }, { word: 'said', rank: 5 },
  ],
  they: [
    { word: 'are', rank: 1 }, { word: 'have', rank: 2 }, { word: 'were', rank: 3 },
    { word: 'will', rank: 4 }, { word: 'can', rank: 5 },
  ],
  would: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 }, { word: 'like', rank: 3 },
    { word: 'not', rank: 4 },
  ],
  will: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 }, { word: 'not', rank: 3 },
    { word: 'make', rank: 4 },
  ],
  can: [
    { word: 'be', rank: 1 }, { word: 'help', rank: 2 }, { word: 'do', rank: 3 },
    { word: 'make', rank: 4 }, { word: 'get', rank: 5 },
  ],
  do: [
    { word: 'you', rank: 1 }, { word: 'not', rank: 2 }, { word: 'it', rank: 3 },
    { word: 'the', rank: 4 }, { word: 'this', rank: 5 },
  ],
  not: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 }, { word: 'know', rank: 3 },
    { word: 'want', rank: 4 }, { word: 'only', rank: 5 },
  ],
  all: [
    { word: 'the', rank: 1 }, { word: 'of', rank: 2 }, { word: 'day', rank: 3 },
  ],
  but: [
    { word: 'the', rank: 1 }, { word: 'I', rank: 2 }, { word: 'it', rank: 3 },
    { word: 'also', rank: 4 },
  ],
  what: [
    { word: 'is', rank: 1 }, { word: 'do', rank: 2 }, { word: 'are', rank: 3 },
    { word: 'the', rank: 4 }, { word: 'I', rank: 5 },
  ],
  when: [
    { word: 'I', rank: 1 }, { word: 'the', rank: 2 }, { word: 'you', rank: 3 },
    { word: 'it', rank: 4 },
  ],
  how: [
    { word: 'to', rank: 1 }, { word: 'do', rank: 2 }, { word: 'much', rank: 3 },
    { word: 'many', rank: 4 }, { word: 'about', rank: 5 },
  ],
  so: [
    { word: 'I', rank: 1 }, { word: 'much', rank: 2 }, { word: 'that', rank: 3 },
    { word: 'many', rank: 4 },
  ],
  been: [
    { word: 'a', rank: 1 }, { word: 'to', rank: 2 }, { word: 'doing', rank: 3 },
  ],
  there: [
    { word: 'is', rank: 1 }, { word: 'are', rank: 2 }, { word: 'was', rank: 3 },
    { word: 'were', rank: 4 },
  ],
  just: [
    { word: 'a', rank: 1 }, { word: 'like', rank: 2 }, { word: 'want', rank: 3 },
  ],
  about: [
    { word: 'the', rank: 1 }, { word: 'it', rank: 2 }, { word: 'this', rank: 3 },
    { word: 'how', rank: 4 },
  ],
  more: [
    { word: 'than', rank: 1 }, { word: 'about', rank: 2 }, { word: 'of', rank: 3 },
  ],
  very: [
    { word: 'much', rank: 1 }, { word: 'good', rank: 2 }, { word: 'well', rank: 3 },
    { word: 'happy', rank: 4 },
  ],
  also: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'have', rank: 3 },
  ],
  after: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'that', rank: 3 },
  ],
  should: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 }, { word: 'not', rank: 3 },
  ],
  could: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 }, { word: 'not', rank: 3 },
  ],
  had: [
    { word: 'a', rank: 1 }, { word: 'been', rank: 2 }, { word: 'to', rank: 3 },
    { word: 'the', rank: 4 }, { word: 'no', rank: 5 },
  ],
  did: [
    { word: 'not', rank: 1 }, { word: 'you', rank: 2 }, { word: 'the', rank: 3 },
  ],
  get: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'to', rank: 3 },
  ],
  make: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'it', rank: 3 },
    { word: 'sure', rank: 4 },
  ],
  go: [
    { word: 'to', rank: 1 }, { word: 'back', rank: 2 }, { word: 'ahead', rank: 3 },
  ],
  like: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'to', rank: 3 },
    { word: 'that', rank: 4 }, { word: 'this', rank: 5 },
  ],
  know: [
    { word: 'that', rank: 1 }, { word: 'what', rank: 2 }, { word: 'how', rank: 3 },
    { word: 'about', rank: 4 },
  ],
  take: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'care', rank: 3 },
  ],
  come: [
    { word: 'back', rank: 1 }, { word: 'to', rank: 2 }, { word: 'from', rank: 3 },
  ],
  think: [
    { word: 'about', rank: 1 }, { word: 'that', rank: 2 }, { word: 'of', rank: 3 },
    { word: 'it', rank: 4 },
  ],
  want: [
    { word: 'to', rank: 1 }, { word: 'a', rank: 2 }, { word: 'the', rank: 3 },
  ],
  give: [
    { word: 'me', rank: 1 }, { word: 'you', rank: 2 }, { word: 'a', rank: 3 },
  ],
  use: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'it', rank: 3 },
  ],
  find: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'out', rank: 3 },
  ],
  tell: [
    { word: 'me', rank: 1 }, { word: 'you', rank: 2 }, { word: 'them', rank: 3 },
  ],
  ask: [
    { word: 'for', rank: 1 }, { word: 'me', rank: 2 }, { word: 'about', rank: 3 },
  ],
  work: [
    { word: 'on', rank: 1 }, { word: 'with', rank: 2 }, { word: 'for', rank: 3 },
  ],
  seem: [
    { word: 'to', rank: 1 }, { word: 'like', rank: 2 },
  ],
  feel: [
    { word: 'like', rank: 1 }, { word: 'good', rank: 2 }, { word: 'better', rank: 3 },
  ],
  try: [
    { word: 'to', rank: 1 }, { word: 'it', rank: 2 },
  ],
  leave: [
    { word: 'the', rank: 1 }, { word: 'it', rank: 2 },
  ],
  call: [
    { word: 'me', rank: 1 }, { word: 'it', rank: 2 }, { word: 'the', rank: 3 },
  ],
  name: [
    { word: 'is', rank: 1 }, { word: 'of', rank: 2 },
  ],
  keep: [
    { word: 'the', rank: 1 }, { word: 'it', rank: 2 }, { word: 'going', rank: 3 },
  ],
  let: [
    { word: 'me', rank: 1 }, { word: 'us', rank: 2 }, { word: 'the', rank: 3 },
  ],
  begin: [
    { word: 'to', rank: 1 }, { word: 'with', rank: 2 },
  ],
  show: [
    { word: 'you', rank: 1 }, { word: 'the', rank: 2 }, { word: 'me', rank: 3 },
  ],
  hear: [
    { word: 'about', rank: 1 }, { word: 'from', rank: 2 },
  ],
  play: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 }, { word: 'with', rank: 3 },
  ],
  run: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 },
  ],
  move: [
    { word: 'to', rank: 1 }, { word: 'the', rank: 2 },
  ],
  live: [
    { word: 'in', rank: 1 }, { word: 'with', rank: 2 },
  ],
  believe: [
    { word: 'that', rank: 1 }, { word: 'in', rank: 2 },
  ],
  bring: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 },
  ],
  happen: [
    { word: 'to', rank: 1 },
  ],
  must: [
    { word: 'be', rank: 1 }, { word: 'have', rank: 2 },
  ],
  say: [
    { word: 'that', rank: 1 }, { word: 'the', rank: 2 }, { word: 'it', rank: 3 },
  ],
  said: [
    { word: 'the', rank: 1 }, { word: 'that', rank: 2 }, { word: 'he', rank: 3 },
  ],
  each: [
    { word: 'other', rank: 1 }, { word: 'of', rank: 2 },
  ],
  which: [
    { word: 'is', rank: 1 }, { word: 'was', rank: 2 }, { word: 'the', rank: 3 },
  ],
  their: [
    { word: 'own', rank: 1 }, { word: 'first', rank: 2 },
  ],
  an: [
    { word: 'important', rank: 1 }, { word: 'example', rank: 2 },
  ],
  up: [
    { word: 'to', rank: 1 }, { word: 'with', rank: 2 }, { word: 'the', rank: 3 },
  ],
  out: [
    { word: 'of', rank: 1 }, { word: 'the', rank: 2 },
  ],
  them: [
    { word: 'to', rank: 1 }, { word: 'the', rank: 2 },
  ],
  then: [
    { word: 'the', rank: 1 }, { word: 'I', rank: 2 },
  ],
  look: [
    { word: 'at', rank: 1 }, { word: 'like', rank: 2 }, { word: 'for', rank: 3 },
  ],
  only: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 }, { word: 'one', rank: 3 },
  ],
  its: [
    { word: 'own', rank: 1 }, { word: 'first', rank: 2 },
  ],
  over: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 },
  ],
  such: [
    { word: 'a', rank: 1 }, { word: 'as', rank: 2 },
  ],
  even: [
    { word: 'though', rank: 1 }, { word: 'more', rank: 2 }, { word: 'if', rank: 3 },
  ],
  most: [
    { word: 'of', rank: 1 }, { word: 'people', rank: 2 }, { word: 'important', rank: 3 },
  ],
  really: [
    { word: 'good', rank: 1 }, { word: 'like', rank: 2 }, { word: 'want', rank: 3 },
  ],
  still: [
    { word: 'have', rank: 1 }, { word: 'a', rank: 2 },
  ],
  never: [
    { word: 'been', rank: 1 }, { word: 'have', rank: 2 },
  ],
  always: [
    { word: 'been', rank: 1 }, { word: 'have', rank: 2 },
  ],
  every: [
    { word: 'day', rank: 1 }, { word: 'time', rank: 2 }, { word: 'one', rank: 3 },
  ],
  because: [
    { word: 'of', rank: 1 }, { word: 'I', rank: 2 }, { word: 'the', rank: 3 },
  ],
  help: [
    { word: 'me', rank: 1 }, { word: 'you', rank: 2 }, { word: 'with', rank: 3 },
  ],
  people: [
    { word: 'who', rank: 1 }, { word: 'are', rank: 2 }, { word: 'with', rank: 3 },
  ],
  going: [
    { word: 'to', rank: 1 },
  ],
  being: [
    { word: 'a', rank: 1 }, { word: 'the', rank: 2 },
  ],
  right: [
    { word: 'now', rank: 1 }, { word: 'here', rank: 2 },
  ],
  well: [
    { word: 'I', rank: 1 }, { word: 'the', rank: 2 },
  ],
  some: [
    { word: 'of', rank: 1 }, { word: 'people', rank: 2 },
  ],
  back: [
    { word: 'to', rank: 1 }, { word: 'in', rank: 2 },
  ],
  much: [
    { word: 'more', rank: 1 }, { word: 'better', rank: 2 },
  ],
  before: [
    { word: 'the', rank: 1 }, { word: 'I', rank: 2 },
  ],
  through: [
    { word: 'the', rank: 1 }, { word: 'a', rank: 2 },
  ],
  way: [
    { word: 'to', rank: 1 }, { word: 'of', rank: 2 },
  ],
  where: [
    { word: 'the', rank: 1 }, { word: 'I', rank: 2 }, { word: 'you', rank: 3 },
  ],
  between: [
    { word: 'the', rank: 1 }, { word: 'two', rank: 2 },
  ],
  too: [
    { word: 'much', rank: 1 }, { word: 'many', rank: 2 },
  ],
  around: [
    { word: 'the', rank: 1 },
  ],
  long: [
    { word: 'time', rank: 1 }, { word: 'ago', rank: 2 },
  ],
  down: [
    { word: 'the', rank: 1 }, { word: 'to', rank: 2 },
  ],
  day: [
    { word: 'of', rank: 1 }, { word: 'and', rank: 2 },
  ],
  another: [
    { word: 'one', rank: 1 }, { word: 'way', rank: 2 },
  ],
};
