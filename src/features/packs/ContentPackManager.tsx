
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  PackageCheck,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../data/database';
import { now } from '../../data/repository';
import type { PackRecord } from '../../domain/models';

type Kind =
  | 'lessons'
  | 'sources'
  | 'words'
  | 'grammarTopics'
  | 'exercises'
  | 'notes';

type Row = Record<string, unknown>;

type Pack = {
  schemaVersion: number;
  packId: string;
  title: string;
  description?: string;
  version: string;
  records: Partial<Record<Kind, Row[]>>;
};

type Preview = {
  pack: Pack;
  counts: Record<Kind, { add: number; update: number; conflict: number }>;
  records: Partial<Record<Kind, Row[]>>;
};

type PackPayload = {
  description?: string;
  originals?: Record<string, Row>;
  overrides?: Record<string, Row>;
  importedRecordIds?: string[];
};

const kinds: Kind[] = [
  'lessons',
  'sources',
  'words',
  'grammarTopics',
  'exercises',
  'notes'
];

const required: Record<Kind, string[]> = {
  lessons: ['id', 'title', 'topic', 'date'],
  sources: ['id', 'title', 'type'],
  words: ['id', 'term', 'translation'],
  grammarTopics: ['id', 'title'],
  exercises: ['id', 'title', 'type', 'payload'],
  notes: ['id', 'title', 'text']
};

const labels: Record<Kind, [string, string]> = {
  lessons: ['Занятия', 'Lessons'],
  sources: ['Материалы', 'Materials'],
  words: ['Слова', 'Words'],
  grammarTopics: ['Темы грамматики', 'Grammar topics'],
  exercises: ['Упражнения', 'Exercises'],
  notes: ['Заметки', 'Notes']
};

const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, canonical(v[k])])
        )
      : v;

const stable = (v: unknown) => JSON.stringify(canonical(v));

function validRecord(kind: Kind, row: Row) {
  const fieldsOk = required[kind].every(
    k => typeof row[k] === 'string' && String(row[k]).trim()
  );

  const payloadOk =
    kind !== 'exercises' ||
    (typeof row.payload === 'object' && row.payload !== null);

  const url = typeof row.url === 'string' ? row.url : '';

  return fieldsOk && payloadOk && (!url || /^https?:\/\//i.test(url));
}

function fieldOverrides(current: Row, original?: Row) {
  if (!original) return {};

  const result: Row = {};

  for (const key of new Set([
    ...Object.keys(current),
    ...Object.keys(original)
  ])) {
    if (stable(current[key]) !== stable(original[key])) {
      result[key] = current[key];
    }
  }

  return result;
}

function packError(
  error: unknown,
  ru: boolean,
  importing = false
) {
  const message = error instanceof Error ? error.message : '';
  const t = (r: string, e: string) => (ru ? r : e);

  if (message === 'Too many records') {
    return t(
      'В пакете слишком много записей.',
      'The package contains too many records.'
    );
  }

  if (message === 'Invalid package manifest') {
    return t(
      'Манифест пакета некорректен или не поддерживается.',
      'The package manifest is invalid or unsupported.'
    );
  }

  const invalid = message.match(
    /^(Invalid|Invalid record in|Duplicate IDs in) (lessons|sources|words|grammarTopics|exercises|notes)(?:: (.*))?$/
  );

  if (invalid) {
    const kind = labels[invalid[2] as Kind][ru ? 0 : 1];
    const details = invalid[3] ? ` ${invalid[3]}` : '';

    if (invalid[1] === 'Duplicate IDs in') {
      return t(
        `В разделе «${kind}» есть повторяющиеся идентификаторы.${details}`,
        `Duplicate IDs were found in ${kind}.${details}`
      );
    }

    return t(
      `Данные раздела «${kind}» некорректны.${details}`,
      `The ${kind} data is invalid.${details}`
    );
  }

  const missing = message.match(
    /^Missing (source|grammar topic|note topic|note lesson) reference: (.+)$/
  );

  if (missing) {
    const target = ({
      source: t('материал', 'material'),
      'grammar topic': t('тему грамматики', 'grammar topic'),
      'note topic': t('тему заметки', 'note topic'),
      'note lesson': t('урок заметки', 'note lesson')
    } as Record<string, string>)[missing[1]];

    return t(
      `Не найдена связанная запись: ${target} «${missing[2]}».`,
      `A referenced ${target} was not found: “${missing[2]}”.`
    );
  }

  return importing
    ? t(
        `Не удалось импортировать пакет. ${message}`,
        `Could not import the package. ${message}`
      )
    : t(
        `Файл некорректен, повреждён или имеет неподдерживаемый формат. ${message}`,
        `The file is invalid, damaged, or uses an unsupported format. ${message}`
      );
}

export function ContentPackManager({
  refresh,
  lang
}: {
  refresh: () => Promise<void>;
  lang: 'ru' | 'en';
}) {
  const ru = lang === 'ru';

  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [installed, setInstalled] = useState<PackRecord[]>([]);

  const loadPacks = async () =>
    setInstalled(
      await db.packs.orderBy('importedAt').reverse().toArray()
    );

  useEffect(() => {
    void loadPacks();
  }, []);

  const packList = useMemo(
    () =>
      preview
        ? kinds.filter(k => (preview.pack.records[k] || []).length)
        : [],
    [preview]
  );

  const readFile = async (file?: File) => {
    setMessage('');
    setPreview(null);

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage(ru ? 'Файл больше 5 МБ.' : 'File exceeds 5 MB.');
      return;
    }

    try {
      const raw = JSON.parse(await file.text()) as Pack;

      if (
        raw.schemaVersion !== 1 ||
        typeof raw.packId !== 'string' ||
        !raw.packId.trim() ||
        typeof raw.title !== 'string' ||
        typeof raw.version !== 'string' ||
        !raw.records ||
        typeof raw.records !== 'object'
      ) {
        throw new Error('Invalid package manifest');
      }

      const records: Preview['records'] = {};
      const counts = {} as Preview['counts'];

      const old = await db.packs.where({ packId: raw.packId }).last();
      const previous = (old?.payload || {}) as PackPayload;
      const originals = previous.originals || {};

      for (const kind of kinds) {
        const rows = raw.records[kind] || [];

        if (!Array.isArray(rows)) {
          throw new Error(`Invalid ${kind}`);
        }

        if (rows.length > 500) {
          throw new Error('Too many records');
        }

        const cleaned = rows as Row[];

        // Расширенная диагностика некорректной записи
        const invalidRow = cleaned.find(
          r =>
            !r ||
            typeof r !== 'object' ||
            !validRecord(kind, r)
        );

        if (invalidRow) {
          const missingFields = required[kind].filter(
            field =>
              typeof invalidRow[field] !== 'string' ||
              !String(invalidRow[field]).trim()
          );

          const details = {
            kind,
            id: invalidRow.id ?? null,
            missingFields,
            payloadType:
              invalidRow.payload === null
                ? 'null'
                : typeof invalidRow.payload
          };

          console.error(
            'LUMO import validation error:',
            details,
            invalidRow
          );

          throw new Error(
            `Invalid record in ${kind}: ${JSON.stringify(details)}`
          );
        }

        const ids = cleaned.map(r => String(r.id));

        if (new Set(ids).size !== ids.length) {
          throw new Error(`Duplicate IDs in ${kind}`);
        }

        records[kind] = cleaned;

        const table = (db as any)[kind];

        let add = 0;
        let update = 0;
        let conflict = 0;

        for (const row of cleaned) {
          const existing = await table.get(String(row.id));

          if (!existing) {
            add++;
          } else if (originals[`${kind}:${row.id}`]) {
            update++;
          } else {
            conflict++;
          }
        }

        counts[kind] = { add, update, conflict };
      }

      const incoming = (kind: Kind, id: string) =>
        Boolean((records[kind] || []).some(r => r.id === id));

      const hasOrIncoming = async (kind: Kind, id: string) =>
        incoming(kind, id) ||
        Boolean(await (db as any)[kind].get(id));

      for (const lesson of records.lessons || []) {
        if (
          typeof lesson.sourceId === 'string' &&
          !(await hasOrIncoming('sources', lesson.sourceId))
        ) {
          throw new Error(
            `Missing source reference: ${lesson.sourceId}`
          );
        }
      }

      for (const exercise of records.exercises || []) {
        if (
          typeof exercise.topicId === 'string' &&
          !(await hasOrIncoming(
            'grammarTopics',
            exercise.topicId
          ))
        ) {
          throw new Error(
            `Missing grammar topic: ${exercise.topicId}`
          );
        }
      }

      for (const note of records.notes || []) {
        if (
          typeof note.topicId === 'string' &&
          !(await hasOrIncoming('grammarTopics', note.topicId))
        ) {
          throw new Error(
            `Missing note topic: ${note.topicId}`
          );
        }

        if (
          typeof note.lessonId === 'string' &&
          !(await hasOrIncoming('lessons', note.lessonId))
        ) {
          throw new Error(
            `Missing note lesson: ${note.lessonId}`
          );
        }
      }

      setPreview({ pack: raw, counts, records });
    } catch (e) {
      console.error('LUMO package preview error:', e);
      setPreview(null);
      setMessage(packError(e, ru));
    }
  };

  const apply = async () => {
    if (!preview) return;

    setBusy(true);
    setMessage('');

    try {
      const pack = preview.pack;
      const old = await db.packs.where({ packId: pack.packId }).last();
      const previous = (old?.payload || {}) as PackPayload;

      const originals: Record<string, Row> = {
        ...(previous.originals || {})
      };

      const overrides: Record<string, Row> = {
        ...(previous.overrides || {})
      };

      const importedRecordIds: string[] = [];

      await db.transaction(
        'rw',
        [
          db.lessons,
          db.sources,
          db.words,
          db.grammarTopics,
          db.exercises,
          db.notes,
          db.packs
        ],
        async () => {
          for (const kind of kinds) {
            const table = (db as any)[kind];

            for (const row of preview.records[kind] || []) {
              const key = `${kind}:${row.id}`;
              const existing = await table.get(String(row.id));

              importedRecordIds.push(key);

              if (!existing) {
                await table.add(row);
                originals[key] = row;
                delete overrides[key];
              } else {
                const baseline = originals[key];

                if (baseline) {
                  const personal = fieldOverrides(existing, baseline);
                  const merged = { ...row, ...personal };

                  await table.put(merged);
                  originals[key] = row;

                  if (Object.keys(personal).length) {
                    overrides[key] = personal;
                  } else {
                    delete overrides[key];
                  }
                }
              }
            }
          }

          const record: PackRecord = {
            id: old?.id || pack.packId,
            packId: pack.packId,
            version: pack.version,
            title: pack.title,
            payload: {
              description: pack.description || '',
              originals,
              overrides,
              importedRecordIds
            } satisfies PackPayload,
            importedAt: now()
          };

          await db.packs.put(record);
        }
      );

      await refresh();
      await loadPacks();
      setPreview(null);

      setMessage(
        ru
          ? 'Пакет импортирован. Личные изменения сохранены по отдельным полям.'
          : 'Package imported. Personal field-level edits were preserved.'
      );
    } catch (e) {
      console.error('LUMO package import error:', e);
      setMessage(packError(e, ru, true));
    } finally {
      setBusy(false);
    }
  };

  const detach = async (pack: PackRecord) => {
    if (
      !window.confirm(
        ru
          ? `Удалить пакет «${pack.title}» из списка? Уже импортированные материалы останутся в приложении.`
          : `Remove “${pack.title}” from the package list? Imported content will remain in the app.`
      )
    ) {
      return;
    }

    await db.packs.delete(pack.id);
    await loadPacks();

    setMessage(
      ru
        ? 'Пакет удалён из списка. Его материалы сохранены.'
        : 'Package removed from the list. Its content was kept.'
    );
  };

  return (
    <section className="panel pack-manager">
      <div className="panel-heading">
        <div>
          <h2>{ru ? 'Учебные пакеты' : 'Content packs'}</h2>
          <p className="pack-intro">
            {ru
              ? 'Импортируй подготовленные наборы уроков, слов, грамматики и упражнений.'
              : 'Import prepared lessons, vocabulary, grammar topics and exercises.'}
          </p>
        </div>

        <label className="primary pack-upload">
          <FileUp size={16} />
          {ru ? 'Выбрать JSON' : 'Choose JSON'}
          <input
            type="file"
            accept="application/json,.json"
            onChange={e => {
              void readFile(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {message && <p className="pack-message">{message}</p>}

      {preview && (
        <div className="pack-preview">
          <div className="pack-title">
            <PackageCheck size={22} />
            <div>
              <b>{preview.pack.title}</b>
              <small>
                {preview.pack.description || preview.pack.packId} · v
                {preview.pack.version}
              </small>
            </div>
          </div>

          <p className="muted">
            {ru
              ? 'Предварительный просмотр. При обновлении будут заменены поля без личных изменений; отредактированные поля останутся нетронутыми. Записи без истории импорта считаются конфликтами и не перезаписываются.'
              : 'Preview. Updates replace fields without personal edits; edited fields are preserved. Existing records without import history are treated as conflicts and are not overwritten.'}
          </p>

          <div className="pack-counts">
            {packList.map(k => (
              <div className="pack-count-row" key={k}>
                <b>{labels[k][ru ? 0 : 1]}</b>
                <span className="pack-add">+{preview.counts[k].add}</span>
                <span className="pack-update">
                  ↻{preview.counts[k].update}
                </span>
                <span className="pack-conflict">
                  !{preview.counts[k].conflict}
                </span>
              </div>
            ))}
          </div>

          <div className="pack-legend">
            <span>+ {ru ? 'новые' : 'new'}</span>
            <span>
              ↻{' '}
              {ru
                ? 'обновятся с сохранением личных полей'
                : 'update, keep personal fields'}
            </span>
            <span>
              !{' '}
              {ru
                ? 'конфликт — запись не меняется'
                : 'conflict — record unchanged'}
            </span>
          </div>

          <div className="pack-actions">
            <button
              className="small-secondary"
              onClick={() => setPreview(null)}
            >
              {ru ? 'Отмена' : 'Cancel'}
            </button>

            <button
              className="primary"
              disabled={busy}
              onClick={() => void apply()}
            >
              <CheckCircle2 size={15} />
              {busy
                ? ru
                  ? 'Импорт…'
                  : 'Importing…'
                : ru
                  ? 'Подтвердить импорт'
                  : 'Confirm import'}
            </button>
          </div>
        </div>
      )}

      <div className="pack-hint">
        <AlertTriangle size={16} />
        <span>
          {ru
            ? 'Формат JSON, версия схемы 1, до 5 МБ. При обновлении не удаляются записи, отсутствующие в новой версии пакета.'
            : 'JSON format, schema version 1, up to 5 MB. Updates do not delete records omitted from a newer package version.'}
        </span>
      </div>

      <div className="installed-packs">
        <div className="panel-heading">
          <h3>{ru ? 'Установленные пакеты' : 'Installed packages'}</h3>
          <button
            className="icon-button"
            title={ru ? 'Обновить список' : 'Refresh list'}
            onClick={() => void loadPacks()}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {installed.length === 0 ? (
          <p className="muted">
            {ru
              ? 'Пока нет импортированных пакетов.'
              : 'No imported packages yet.'}
          </p>
        ) : (
          installed.map(p => (
            <div className="installed-pack" key={p.id}>
              <div>
                <b>{p.title}</b>
                <small>
                  v{p.version} ·{' '}
                  {new Date(p.importedAt).toLocaleDateString(
                    ru ? 'ru-RU' : 'en-GB'
                  )}
                </small>
              </div>

              <button
                className="small-secondary"
                onClick={() => void detach(p)}
              >
                <Trash2 size={14} />
                {ru ? 'Убрать пакет' : 'Remove package'}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
