// Rotated on interstitials; index picks deterministically by step (stable across re-renders).
export const QUOTES = [
  { text: 'i have always imagined that paradise will be a kind of library.', who: 'jorge luis borges' },
  { text: 'books are the carriers of civilization. without books, history is silent.', who: 'barbara tuchman' },
  { text: 'the good reader is a re-reader.', who: 'vladimir nabokov' },
  { text: 'we read to know we are not alone.', who: 'c.s. lewis' },
  { text: 'reading is sometimes an ingenious device for avoiding thought.', who: 'arthur helps' },
  { text: 'to read is to fold time.', who: 'anonymous' },
  { text: 'you cannot open a book without learning something.', who: 'confucius' },
  { text: 'literature is the most agreeable way of ignoring life.', who: 'fernando pessoa' },
  { text: 'no book is worth reading that isn\'t worth re-reading.', who: 'susan sontag' },
  { text: 'we don\'t read and write poetry because it\'s cute. we read and write poetry because we are members of the human race.', who: 'john keating, dead poets society' },
];

export function quoteForStep(stepIndex) {
  return QUOTES[stepIndex % QUOTES.length];
}
