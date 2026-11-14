import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/domain/vocabulary.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022},
}).outputText;
const vocabulary = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const words = [
  {id: 'new', term: 'apple', translation: 'яблоко', status: 'new', reviewIntervalDays: 0, example: 'I eat an apple.'},
  {id: 'due', term: 'book', translation: 'книга', status: 'learning', reviewIntervalDays: 1, example: 'I read a book.', nextReviewAt: '2026-03-09T12:00:00.000Z'},
  {id: 'missing-example', term: 'water', translation: 'вода', status: 'new', reviewIntervalDays: 0},
  {id: 'missing-translation', term: 'hello', translation: ' ', status: 'new', reviewIntervalDays: 0},
];

test('normalizes case and whitespace without accepting a different translation', () => {
  assert.equal(vocabulary.isTranslationCorrect('  New   York  ', 'new york'), true);
  assert.equal(vocabulary.isTranslationCorrect('new jersey', 'new york'), false);
});

test('uses the existing spaced-repetition intervals and resets again to one day', () => {
  assert.deepEqual([0, 1, 3, 7, 14, 30].map(days => vocabulary.nextReviewInterval(days, true)), [1, 3, 7, 14, 30, 30]);
  assert.equal(vocabulary.nextReviewInterval(14, false), 1);
  assert.deepEqual(vocabulary.reviewSchedule(7, false, new Date('2026-03-10T12:00:00.000Z')), {
    intervalDays: 1,
    reviewIntervalDays: 0,
    status: 'learning',
    nextReviewAt: '2026-03-11T12:00:00.000Z',
  });
});

test('creates cloze sentences only when the example contains the word or a blank', () => {
  assert.equal(vocabulary.makeClozeSentence('I eat an apple.', 'apple'), 'I eat an _____.');
  assert.equal(vocabulary.makeClozeSentence('The theme is clear.', 'he'), null);
  assert.equal(vocabulary.makeClozeSentence('I drink _____.', 'water'), 'I drink _____.');
});

test('queues due and new words only when the selected mode has required data', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');
  assert.deepEqual(vocabulary.vocabularyQueue(words, 'translation', 'due', now).map(word => word.id), ['due']);
  assert.deepEqual(vocabulary.vocabularyQueue(words, 'translation', 'new', now).map(word => word.id), ['new', 'missing-example']);
  assert.deepEqual(vocabulary.vocabularyQueue(words, 'context', 'new', now).map(word => word.id), ['new']);
});

test('shuffles without mutating the source array and selects a date-stable real word', () => {
  const source = words.slice(0, 3);
  const shuffled = vocabulary.shuffleWords(source, () => 0);
  assert.deepEqual(source.map(word => word.id), ['new', 'due', 'missing-example']);
  assert.deepEqual([...shuffled.map(word => word.id)].sort(), ['due', 'missing-example', 'new']);
  assert.equal(vocabulary.wordOfDay(source, new Date(2026, 2, 10, 2)).id,
    vocabulary.wordOfDay(source, new Date(2026, 2, 10, 22)).id);
});
