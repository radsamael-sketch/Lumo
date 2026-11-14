import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/data/backup.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022},
}).outputText;
const {BACKUP_TABLES, validateBackup} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`,
);

const timestamp = '2026-11-14T08:00:00.000Z';

function createBackup() {
  const tables = Object.fromEntries(BACKUP_TABLES.map(name => [name, []]));
  const exercise = {
    id: 'exercise-1',
    title: 'Choose an answer',
    type: 'multiple-choice',
    payload: {
      prompt: 'Choose',
      options: [{id: 'option-a', text: 'A'}, {id: 'option-b', text: 'B'}],
      correctOptionId: 'option-a',
    },
    topicId: 'topic-1',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  tables.lessons.push({
    id: 'lesson-1',
    title: 'Lesson',
    topic: 'Topic',
    date: '2024-02-29',
    duration: 30,
    actualDuration: 0,
    status: 'planned',
    sourceId: 'source-1',
    seriesId: 'series-1',
    recurrence: 'weekly',
    weekdays: [1, 3],
    occurrenceDate: '2024-02-29',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  tables.sources.push({id: 'source-1', title: 'Book', type: 'website', createdAt: timestamp, updatedAt: timestamp});
  tables.words.push({
    id: 'word-1',
    term: 'word',
    translation: 'слово',
    status: 'learning',
    reviewIntervalDays: 1,
    nextReviewAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  tables.reviews.push({id: 'review-1', wordId: 'word-1', result: 'known', reviewedAt: timestamp, intervalDays: 1});
  tables.grammarTopics.push({id: 'topic-1', title: 'Grammar', createdAt: timestamp, updatedAt: timestamp});
  tables.exercises.push(exercise);
  tables.attempts.push({
    id: 'attempt-1',
    exerciseId: exercise.id,
    correct: true,
    answer: 'option-a',
    snapshot: structuredClone(exercise),
    createdAt: timestamp,
  });
  tables.tests.push({
    id: 'test-1',
    title: 'Test',
    exerciseIds: [exercise.id],
    startedAt: timestamp,
    completedAt: timestamp,
    totalQuestions: 1,
    correctAnswers: 1,
  });
  tables.notes.push({
    id: 'note-1',
    title: 'Note',
    text: 'Text',
    topicId: 'topic-1',
    lessonId: 'lesson-1',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  tables.settings.push({key: 'language', value: 'ru'});
  tables.packs.push({
    id: 'pack-1',
    packId: 'pack-1',
    version: '1.0',
    title: 'Pack',
    payload: {
      description: '',
      originals: {'words:word-1': {id: 'word-1'}},
      overrides: {},
      importedRecordIds: ['words:word-1'],
    },
    importedAt: timestamp,
  });
  return {app: 'LUMO', formatVersion: 1, exportedAt: timestamp, tables};
}

test('accepts a complete backup and preserves pack overrides', () => {
  const backup = createBackup();
  const validated = validateBackup(backup);
  assert.deepEqual(Object.keys(validated.tables), BACKUP_TABLES);
  assert.deepEqual(validated.tables.packs, backup.tables.packs);
});

test('accepts records with fields omitted by supported content packs', () => {
  const backup = createBackup();
  backup.tables.lessons[0] = {id: 'lesson-1', title: 'Lesson', topic: 'Topic', date: '2024-02-29'};
  backup.tables.words[0] = {id: 'word-1', term: 'word', translation: 'слово'};
  backup.tables.exercises[0] = {
    id: 'exercise-1',
    title: 'Choose an answer',
    type: 'multiple-choice',
    payload: backup.tables.exercises[0].payload,
  };
  assert.doesNotThrow(() => validateBackup(backup));
});

test('rejects missing tables, duplicate keys, invalid enums, dates, and links', () => {
  const cases = [
    backup => { delete backup.tables.tests; },
    backup => { backup.tables.sources.push(structuredClone(backup.tables.sources[0])); },
    backup => { backup.tables.lessons[0].status = 'unknown'; },
    backup => { backup.tables.lessons[0].date = '2024-02-30'; },
    backup => { backup.tables.lessons[0].sourceId = 'missing-source'; },
    backup => { backup.tables.exercises[0].type = 'unknown'; },
    backup => { backup.tables.attempts[0].answer = 'missing-option'; },
  ];
  for (const change of cases) {
    const backup = createBackup();
    change(backup);
    assert.throws(() => validateBackup(backup));
  }
});

test('preserves the recorded outcome of a structurally valid historical attempt', () => {
  const backup = createBackup();
  backup.tables.attempts[0].correct = false;
  assert.equal(validateBackup(backup).tables.attempts[0].correct, false);
});

test('keeps historical attempts and reviews when their live records are absent', () => {
  const backup = createBackup();
  backup.tables.exercises = [];
  backup.tables.words = [];
  backup.tables.reviews[0].wordId = 'deleted-word';
  const validated = validateBackup(backup);
  assert.equal(validated.tables.attempts.length, 1);
  assert.equal(validated.tables.reviews.length, 1);
  assert.deepEqual(validated.tables.tests[0].exerciseIds, ['exercise-1']);
});
