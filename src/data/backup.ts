import type {LumoBackupTables} from './backupTypes';

export const BACKUP_TABLES = ['lessons','sources','words','reviews','grammarTopics','exercises','attempts','tests','notes','settings','packs'] as const;
export type BackupTableName = typeof BACKUP_TABLES[number];
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isOptionalText = (value: unknown) => value === undefined || isText(value);
const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isNonNegativeInteger = (value: unknown) => Number.isInteger(value) && isNonNegativeNumber(value);
const isDateKey = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isIsoDate = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  return !!match && isDateKey(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 &&
    Number(match[4]) < 60 && !Number.isNaN(Date.parse(value));
};
const isOptionalIsoDate = (value: unknown) => value === undefined || isIsoDate(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => isText(item));
const hasUniqueIds = (items: Record<string, unknown>[]) =>
  new Set(items.map(item => item.id)).size === items.length;
const isTextItem = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isText(value.id) && !!value.id && isText(value.text);

function isExercisePayload(type: string, value: unknown): boolean {
  if (!isRecord(value) || !isText(value.prompt)) return false;
  if (type === 'multiple-choice') {
    if (!Array.isArray(value.options) || value.options.length < 2 ||
        !value.options.every(isTextItem) || !hasUniqueIds(value.options)) return false;
    return value.options.every(option => isText(option.text) && !!option.text.trim()) && isText(value.correctOptionId) &&
      value.options.some(option => option.id === value.correctOptionId);
  }
  if (type === 'fill-blanks') {
    return isText(value.expected) && !!value.expected.trim() && isStringArray(value.accepted) &&
      value.accepted.every(answer => !!answer.trim());
  }
  if (type === 'matching') {
    if (!Array.isArray(value.left) || !Array.isArray(value.right) || !Array.isArray(value.pairs) ||
        value.left.length === 0 || value.left.length !== value.right.length ||
        !value.left.every(isTextItem) || !value.right.every(isTextItem) ||
        !hasUniqueIds(value.left) || !hasUniqueIds(value.right) || value.pairs.length !== value.left.length ||
        !value.pairs.every(pair => isRecord(pair) && isText(pair.leftId) && isText(pair.rightId))) return false;
    const leftIds = new Set(value.left.map(item => item.id));
    const rightIds = new Set(value.right.map(item => item.id));
    const pairLeft = value.pairs.map(pair => (pair as Record<string, unknown>).leftId);
    const pairRight = value.pairs.map(pair => (pair as Record<string, unknown>).rightId);
    return pairLeft.every(id => leftIds.has(id)) && pairRight.every(id => rightIds.has(id)) &&
      new Set(pairLeft).size === pairLeft.length && new Set(pairRight).size === pairRight.length;
  }
  if (type === 'word-ordering') {
    if (!Array.isArray(value.tokens) || value.tokens.length < 2 ||
        !value.tokens.every(isTextItem) || !hasUniqueIds(value.tokens) || !isStringArray(value.correctOrder)) return false;
    const tokenIds = new Set(value.tokens.map(item => item.id));
    return value.correctOrder.length === tokenIds.size && value.correctOrder.every(id => tokenIds.has(id)) &&
      new Set(value.correctOrder).size === tokenIds.size;
  }
  return false;
}

function isExercise(row: Record<string, unknown>): boolean {
  return isText(row.id) && !!row.id && isText(row.title) && isText(row.type) &&
    (row.type === 'multiple-choice' || row.type === 'fill-blanks' || row.type === 'matching' || row.type === 'word-ordering') &&
    isExercisePayload(row.type, row.payload) && isOptionalText(row.topicId) && isOptionalText(row.explanation) &&
    (row.version === undefined || isNonNegativeInteger(row.version)) &&
    isOptionalIsoDate(row.createdAt) && isOptionalIsoDate(row.updatedAt);
}

function isAttempt(row: Record<string, unknown>): boolean {
  if (!isText(row.id) || !row.id || !isText(row.exerciseId) || !row.exerciseId ||
      typeof row.correct !== 'boolean' || !isIsoDate(row.createdAt) || !isOptionalText(row.testSessionId) ||
      !isRecord(row.snapshot) || !isExercise(row.snapshot) || row.snapshot.id !== row.exerciseId) return false;
  const payload = row.snapshot.payload as Record<string, unknown>;
  let validAnswer = false;
  if (row.snapshot.type === 'multiple-choice') {
    validAnswer = isText(row.answer) && (payload.options as Record<string, unknown>[]).some(option => option.id === row.answer);
  } else if (row.snapshot.type === 'fill-blanks') {
    validAnswer = isText(row.answer);
  } else if (row.snapshot.type === 'matching') {
    const leftIds = new Set((payload.left as Record<string, unknown>[]).map(item => item.id));
    const rightIds = new Set((payload.right as Record<string, unknown>[]).map(item => item.id));
    validAnswer = isRecord(row.answer) && Object.entries(row.answer).every(([leftId, rightId]) =>
      leftIds.has(leftId) && isText(rightId) && rightIds.has(rightId));
  } else {
    const tokenIds = new Set((payload.tokens as Record<string, unknown>[]).map(item => item.id));
    validAnswer = isStringArray(row.answer) && row.answer.every(id => tokenIds.has(id)) &&
      new Set(row.answer).size === row.answer.length;
  }
  return validAnswer;
}

function isPackPayload(value: unknown): boolean {
  if (!isRecord(value) || !isOptionalText(value.description) ||
      (value.importedRecordIds !== undefined && !isStringArray(value.importedRecordIds))) return false;
  for (const field of ['originals', 'overrides']) {
    const records = value[field];
    if (records !== undefined && (!isRecord(records) || !Object.values(records).every(isRecord))) return false;
  }
  return true;
}

const validators: Record<BackupTableName, (row: Record<string, unknown>) => boolean> = {
  lessons: r => isText(r.id) && isText(r.title) && isText(r.topic) && isDateKey(r.date) &&
    (r.duration === undefined || isNonNegativeNumber(r.duration)) &&
    (r.actualDuration === undefined || isNonNegativeNumber(r.actualDuration)) &&
    (r.actualSeconds === undefined || isNonNegativeNumber(r.actualSeconds)) &&
    (r.status === undefined || r.status === 'planned' || r.status === 'in-progress' || r.status === 'completed' || r.status === 'skipped') &&
    isOptionalText(r.time) && isOptionalText(r.sourceId) && isOptionalText(r.url) &&
    isOptionalText(r.description) && isOptionalText(r.notes) && isOptionalText(r.result) &&
    isOptionalText(r.seriesId) && (r.recurrence === undefined || r.recurrence === 'daily' || r.recurrence === 'weekly') &&
    (r.weekdays === undefined || (Array.isArray(r.weekdays) && r.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6))) &&
    (r.occurrenceDate === undefined || isDateKey(r.occurrenceDate)) &&
    isOptionalIsoDate(r.timerStartedAt) && isOptionalIsoDate(r.createdAt) && isOptionalIsoDate(r.updatedAt),
  sources: r => isText(r.id) && isText(r.title) && isText(r.type) &&
    isOptionalText(r.url) && isOptionalText(r.description) && isOptionalIsoDate(r.createdAt) && isOptionalIsoDate(r.updatedAt),
  words: r => isText(r.id) && isText(r.term) && isText(r.translation) &&
    (r.status === undefined || r.status === 'new' || r.status === 'learning' || r.status === 'learned') &&
    (r.reviewIntervalDays === undefined || isNonNegativeNumber(r.reviewIntervalDays)) &&
    isOptionalText(r.transcription) && isOptionalText(r.context) && isOptionalText(r.example) &&
    isOptionalIsoDate(r.nextReviewAt) && isOptionalIsoDate(r.createdAt) && isOptionalIsoDate(r.updatedAt),
  reviews: r => isText(r.id) && isText(r.wordId) && (r.result === 'known' || r.result === 'again') &&
    isIsoDate(r.reviewedAt) && isNonNegativeNumber(r.intervalDays),
  grammarTopics: r => isText(r.id) && isText(r.title) && isOptionalText(r.description) &&
    isOptionalText(r.theory) && isOptionalText(r.examples) && isOptionalText(r.notes) &&
    isOptionalIsoDate(r.createdAt) && isOptionalIsoDate(r.updatedAt),
  exercises: isExercise,
  attempts: isAttempt,
  tests: r => isText(r.id) && isText(r.title) && isStringArray(r.exerciseIds) && isIsoDate(r.startedAt) &&
    isOptionalIsoDate(r.completedAt) && typeof r.totalQuestions === 'number' && Number.isInteger(r.totalQuestions) && isNonNegativeInteger(r.totalQuestions) &&
    typeof r.correctAnswers === 'number' && Number.isInteger(r.correctAnswers) && isNonNegativeInteger(r.correctAnswers) &&
    r.correctAnswers <= r.totalQuestions && r.totalQuestions === r.exerciseIds.length,
  notes: r => isText(r.id) && isText(r.title) && isText(r.text) && isOptionalText(r.topicId) &&
    isOptionalText(r.lessonId) && isOptionalIsoDate(r.createdAt) && isOptionalIsoDate(r.updatedAt),
  settings: r => isText(r.key) && !!r.key.trim() && 'value' in r,
  packs: r => isText(r.id) && isText(r.packId) && isText(r.version) && isText(r.title) &&
    isPackPayload(r.payload) && isIsoDate(r.importedAt),
};
const primaryKeys: Record<BackupTableName, string> = {
  lessons:'id', sources:'id', words:'id', reviews:'id', grammarTopics:'id', exercises:'id', attempts:'id', tests:'id', notes:'id', settings:'key', packs:'id',
};

export interface ValidatedBackup { app: 'LUMO'; formatVersion: 1; exportedAt: string; tables: LumoBackupTables }
export function validateBackup(value: unknown): ValidatedBackup {
  if (!isRecord(value) || value.app !== 'LUMO' || value.formatVersion !== BACKUP_FORMAT_VERSION ||
      !isIsoDate(value.exportedAt) || !isRecord(value.tables)) {
    throw new Error('Файл не является поддерживаемой резервной копией LUMO.');
  }
  const tables = value.tables;
  const result: Record<BackupTableName, Record<string, unknown>[]> = {} as Record<BackupTableName, Record<string, unknown>[]>;
  for (const name of BACKUP_TABLES) {
    const rows = tables[name];
    if (!Array.isArray(rows)) throw new Error(`В резервной копии отсутствует таблица ${name}.`);
    if (rows.length > 100_000) throw new Error(`Слишком много записей в таблице ${name}.`);
    const ids = new Set<string>();
    const validatedRows: Record<string, unknown>[] = [];
    for (const [index, row] of rows.entries()) {
      if (!isRecord(row) || !validators[name](row)) throw new Error(`Некорректная запись ${index + 1} в таблице ${name}.`);
      const key = row[primaryKeys[name]];
      if (typeof key !== 'string' || !key.trim() || ids.has(key)) throw new Error(`Пустой или повторяющийся ключ в таблице ${name}.`);
      ids.add(key);
      validatedRows.push(row);
    }
    result[name] = validatedRows;
  }

  const hasId = (table: BackupTableName, id: unknown) =>
    typeof id === 'string' && result[table].some(row => row[primaryKeys[table]] === id);
  result.lessons.forEach((lesson, index) => {
    if (lesson.sourceId !== undefined && !hasId('sources', lesson.sourceId)) {
      throw new Error(`Некорректная ссылка sourceId в записи ${index + 1} таблицы lessons.`);
    }
  });
  result.exercises.forEach((exercise, index) => {
    if (exercise.topicId !== undefined && !hasId('grammarTopics', exercise.topicId)) {
      throw new Error(`Некорректная ссылка topicId в записи ${index + 1} таблицы exercises.`);
    }
  });
  result.notes.forEach((note, index) => {
    if ((note.topicId !== undefined && !hasId('grammarTopics', note.topicId)) ||
        (note.lessonId !== undefined && !hasId('lessons', note.lessonId))) {
      throw new Error(`Некорректная ссылка в записи ${index + 1} таблицы notes.`);
    }
  });

  return {
    app: 'LUMO',
    formatVersion: 1,
    exportedAt: value.exportedAt as string,
    tables: result as unknown as LumoBackupTables,
  };
}
