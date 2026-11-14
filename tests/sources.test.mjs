import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/domain/sources.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022},
}).outputText;
const sources = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const material = {
  id: 'source-1',
  title: 'English Flow',
  type: 'website',
  url: 'https://example.com/lesson',
  description: 'Grammar practice',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('normalizes required material fields and accepts optional HTTP(S) links', () => {
  assert.deepEqual(sources.normalizeSourceDraft({
    title: '  English Flow ',
    type: ' website ',
    url: ' https://example.com/lesson ',
    description: ' Grammar practice ',
  }), {
    title: 'English Flow',
    type: 'website',
    url: 'https://example.com/lesson',
    description: 'Grammar practice',
  });
  assert.deepEqual(sources.normalizeSourceDraft({title: 'Book', type: 'book'}), {
    title: 'Book',
    type: 'book',
    url: undefined,
    description: undefined,
  });
});

test('rejects empty names, empty types, malformed links, and non-web protocols', () => {
  assert.throws(() => sources.normalizeSourceDraft({title: '  ', type: 'book'}), {message: 'TITLE_REQUIRED'});
  assert.throws(() => sources.normalizeSourceDraft({title: 'Book', type: '  '}), {message: 'TYPE_REQUIRED'});
  assert.throws(() => sources.normalizeSourceDraft({title: 'Book', type: 'book', url: 'not a URL'}), {message: 'URL_INVALID'});
  assert.throws(() => sources.normalizeSourceDraft({title: 'Book', type: 'book', url: 'file:///book.pdf'}), {message: 'URL_INVALID'});
});

test('filters by existing fields and labels known types while preserving custom types', () => {
  assert.equal(sources.sourceMatches(material, 'grammar'), true);
  assert.equal(sources.sourceMatches(material, 'example.com'), true);
  assert.equal(sources.sourceMatches(material, 'video'), false);
  assert.equal(sources.sourceMatches(material, 'grammar', 'website'), true);
  assert.equal(sources.sourceMatches(material, 'grammar', 'video'), false);
  assert.equal(sources.sourceTypeLabel('website', 'ru'), 'Сайт');
  assert.equal(sources.sourceTypeLabel('custom-resource', 'en'), 'custom-resource');
});

test('detaches only the deleted material reference and preserves the lesson', () => {
  const lesson = {
    id: 'lesson-1',
    title: 'Reading',
    topic: 'Grammar',
    date: '2026-01-02',
    duration: 30,
    actualDuration: 10,
    status: 'completed',
    sourceId: material.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const detached = sources.detachSourceReference(lesson, material.id);
  assert.equal(detached.id, lesson.id);
  assert.equal(detached.status, 'completed');
  assert.equal(detached.sourceId, undefined);
  assert.equal(lesson.sourceId, material.id);
  assert.equal(sources.detachSourceReference(lesson, 'other').sourceId, material.id);
});
