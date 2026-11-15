
import type { Word } from './models';

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export type VocabularyMode = 'cards' | 'translation' | 'context';
export type VocabularyQueueKind = 'due' | 'new';

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function isTranslationCorrect(
  answer: string,
  translation: string
): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(translation);
}

export function nextReviewInterval(
  currentIntervalDays: number,
  known: boolean
): number {
  if (!known) return REVIEW_INTERVALS[0];

  return (
    REVIEW_INTERVALS.find(days => days > currentIntervalDays) ??
    REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]
  );
}

export function reviewSchedule(
  currentIntervalDays: number,
  known: boolean,
  reviewedAt = new Date()
) {
  const intervalDays = nextReviewInterval(currentIntervalDays, known);

  return {
    intervalDays,
    reviewIntervalDays: known ? intervalDays : 0,
    status:
      known && intervalDays >= 14
        ? ('learned' as const)
        : ('learning' as const),
    nextReviewAt: new Date(
      reviewedAt.getTime() + intervalDays * 86400000
    ).toISOString()
  };
}

/**
 * Escapes special regular-expression characters.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a cloze sentence by replacing the target word.
 * Supports case-insensitive matching, multi-word expressions
 * and sentences that already contain underscores.
 */
export function makeClozeSentence(
  example: string | undefined,
  term: string
): string | null {
  const sentence = example?.trim();
  const word = term.trim();

  if (!sentence || !word) return null;

  if (/_{2,}/.test(sentence)) {
    return sentence;
  }

  const escaped = escapeRegExp(word).replace(/\s+/g, '\\s+');
  const match = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`,
    'iu'
  );

  const result = match.exec(sentence);
  if (!result) return null;

  return (
    sentence.slice(0, result.index) +
    result[1] +
    '_____' +
    sentence.slice(result.index + result[0].length)
  );
}

function isUsableInMode(
  word: Word,
  mode: VocabularyMode
): boolean {
  if (!word.term?.trim() || !word.translation?.trim()) {
    return false;
  }

  if (mode === 'context') {
    return makeClozeSentence(word.example, word.term) !== null;
  }

  return true;
}

function isDue(word: Word, currentTime: number): boolean {
  if (!word.nextReviewAt) return false;

  const reviewTime = Date.parse(word.nextReviewAt);

  return Number.isFinite(reviewTime) && reviewTime <= currentTime;
}

export function vocabularyQueue(
  words: Word[],
  mode: VocabularyMode,
  kind: VocabularyQueueKind,
  now = new Date()
): Word[] {
  const currentTime = now.getTime();

  return words.filter(word => {
    if (!isUsableInMode(word, mode)) return false;

    const due = isDue(word, currentTime);

    if (kind === 'due') {
      return due;
    }

    // Legacy records without a status are treated as new.
    const isNew = !word.status || word.status === 'new';

    return isNew;
  });
}

export function shuffleWords(
  words: Word[],
  random = Math.random
): Word[] {
  const shuffled = [...words];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));

    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

export function wordOfDay(
  words: Word[],
  date = new Date()
): Word | null {
  if (!words.length) return null;

  const day = Math.floor(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ) / 86400000
  );

  return words[((day % words.length) + words.length) % words.length];
}
