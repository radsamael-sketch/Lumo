# LUMO

A personal, local-first English-learning planner and practice space.

## Stack
- React + TypeScript + Vite
- Dexie / IndexedDB for user data
- vite-plugin-pwa for installability and offline app shell
- CSS for styling

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

## Current implementation status

The current workspace is a reconstruction from the approved LUMO specification. It contains:

- Five-section top navigation: Dashboard, Planning, Vocabulary, Practice, Settings.
- Dashboard with real lesson summaries, a saved Word of the Day, learning metrics, and a persistent 25/50-minute Pomodoro timer.
- Planning with lesson creation, status updates, deletion, and an external learning-material library.
- Vocabulary with create, search, edit, delete, review actions, review history, and 1/3/7/14/30-day intervals.
- Grammar topics with description, theory, examples, and personal notes.
- Exercise authoring for Multiple Choice, Fill in the Blanks, Matching, and Word Ordering.
- Practice runner with answer checking, explanations, and stored attempt snapshots.
- Tests assembled from existing exercises, with saved result summaries and attempts linked to a test session.
- Progress page with metrics calculated from saved records.
- Settings for profile name and Russian/English interface labels.
- Full JSON backup and validated full restore with a protective export before replacement.
- Content-pack import with schema checks, preview counts, atomic writes, field-level personal overrides, and safe package-list removal that leaves imported content intact.
- IndexedDB schema and repository layer; no seeded/demo records.
- Safe deletion of lessons and grammar topics detaches linked notes/exercises instead of leaving broken references or deleting the linked content; historical exercise attempts remain intact.
- Calendar date keys use local calendar dates rather than UTC date slicing, avoiding off-by-one-day errors in positive and negative time zones. Pomodoro updates once per second rather than four times per second.
- Backup restore checks file size, backup format, required tables, primary-key presence, and duplicate keys before creating the protective backup and starting the atomic restore transaction.
- PWA manifest with 192/512 PNG install icons, auto-update, app-shell navigation fallback, and precaching of built static assets.

## Still to implement

- Richer content-pack conflict review and a dedicated archive/re-attach workflow. Removing a package from the installed list currently keeps its imported records in place.
- Automatic extension of recurring lesson series beyond the current 12-week generation window.
- More detailed historical analytics and review trends.
- Full end-to-end testing in a browser, including offline/PWA installation and backup/restore round trips.
- Broader deletion and relationship audit across all content types, plus lesson-level timer/detail workflow verification.

## Validation limitation

Dependencies are not installed in this workspace. A TypeScript check was attempted, but it cannot complete because React, Dexie, Lucide, Vite, and their type declarations are unavailable. Package installation previously timed out due package-registry connectivity. Do not treat the current source as build-verified until `npm install`, `npm run typecheck`, and `npm run build` succeed in a network-enabled environment.

## VS Code handoff

The project includes VS Code workspace settings and tasks. See [`docs/VSCODE_HANDOFF_RU.md`](docs/VSCODE_HANDOFF_RU.md) for the Russian step-by-step transfer, installation, run, backup, and testing guide. Open the extracted project folder in VS Code, then run `npm install` and `npm run dev` in its integrated terminal.

## GitHub Pages deployment

The project is prepared for deployment to GitHub Pages using GitHub Actions. See [`docs/GITHUB_PAGES_RU.md`](docs/GITHUB_PAGES_RU.md) for the complete Russian guide, including GitHub Desktop setup, public-repository safety checks, PWA installation, and future update flow. The build uses the repository name automatically to set the correct Vite base path.

A committed `package-lock.json` is included so GitHub Actions can use `npm ci`.

The browser database is not part of the source repository. Export user data from the app's Settings before changing browser profiles or devices.

## Data principles

- IndexedDB is the primary store for user data.
- UI components use repository/service functions rather than arbitrary IndexedDB access.
- Stable IDs and ISO timestamps are used for records.
- User content is not seeded; first launch is empty.
- Do not delete or recreate the database as part of app updates.
- Schema changes must use a new Dexie version and explicit migration; never reset user data.
- Browser persistent-storage permission reduces automatic eviction risk but is not a substitute for an exported backup.
- User data is local to the browser origin; keep the app on a stable origin and export backups regularly.

## Content-pack JSON format (schemaVersion 1)

A package is a UTF-8 JSON file with a manifest and optional record arrays. Supported record collections are `lessons`, `sources`, `words`, `grammarTopics`, `exercises`, and `notes`. Each record must have a stable string `id` and the required fields for its collection. The importer limits files to 5 MB and each collection to 500 records.

```json
{
  "schemaVersion": 1,
  "packId": "example-a1-basics",
  "title": "A1 Basics",
  "description": "Starter vocabulary and grammar",
  "version": "1.0.0",
  "records": {
    "words": [
      { "id": "a1-word-hello", "term": "hello", "translation": "привет", "status": "new", "reviewIntervalDays": 0, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z" }
    ]
  }
}
```

The preview distinguishes new records, updates to previously imported records, and conflicts with records that have no import baseline. On update, fields that still match the previous package version are refreshed; fields changed locally are retained as personal overrides. Records with no import baseline are never overwritten. Import is committed in one IndexedDB transaction. Removing a package removes only its package manifest from the installed list; its imported records are deliberately retained as ordinary local content. Records omitted from a newer package version are also retained.

## Planning calendar (recovery stage)
- Month calendar with day selection and lesson markers; switch between month and chronological list.
- Lessons can be created with optional time and planned duration.
- Recurrence supports daily and weekly schedules. Weekly schedules accept selected weekdays (1=Monday through 7=Sunday).
- Recurring occurrences are materialized as individual lesson records for the next 12 weeks and share a series ID.
- Editing/deleting can target one occurrence or that occurrence and later entries in its series.
- This is intentionally a lightweight planner, not a full calendar engine; generated series currently cover 12 weeks and do not auto-extend.

## Progress analytics

The Progress screen is calculated from local records: completed lesson actual minutes, vocabulary review history, checked exercise attempts, and completed tests. It shows a seven-day activity breakdown, learned/due vocabulary, recent reviews, recent tests, and grammar topics with the lowest observed answer accuracy. Topic accuracy is only shown when attempts include a saved exercise snapshot linked to that topic. Empty states are used when no history exists; no demo metrics are generated.

## Lesson detail and actual study time

Each planned lesson can be opened from the calendar or list to edit its description, attach a Library source, add an external URL (including an English Flow lesson link), and keep lesson notes. The lesson timer stores a start timestamp and accumulated seconds on the lesson record, so elapsed time continues to be recoverable after navigation, reload, or browser sleep. Pausing adds elapsed seconds to `actualSeconds`; `actualDuration` remains a rounded-down minutes compatibility field. Progress analytics prefer `actualSeconds` when available and fall back to `actualDuration` for older records.

## Backup and restore hardening
- Backup export reads all IndexedDB tables inside one readonly transaction, so the JSON represents one consistent database snapshot.
- Restore validates the LUMO format/version, export timestamp, required tables, record shapes, required fields, primary keys, duplicate keys, and per-table record limits before touching current data.
- Restore preview shows record counts by table. The user must confirm full replacement; a protective export is created immediately before the atomic write transaction.
- Empty tables are restored correctly, and failed validation leaves the current database untouched.
- Backup JSON contains user-created data, imported package manifests and overrides, settings, vocabulary review history, and exercise/test history. It does not include external website contents or binary attachments.

## PWA and offline behavior
- The production service worker precaches the built app shell and static assets, and routes navigation requests to `index.html` so the application can reopen offline after its first successful online load.
- The manifest includes standard 192px and 512px PNG icons plus a maskable icon entry.
- User records remain in IndexedDB; service-worker cache cleanup only manages cached static assets and must never clear the application database.
- The first installation/load requires internet. External websites and media are not made available offline by LUMO.
