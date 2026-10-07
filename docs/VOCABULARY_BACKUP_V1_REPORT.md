# Vocabulary State & Backup V1 — implementation report

The learner can mark a dictionary entry Learning/Known, change/remove its state,
browse vocabulary and carry local learner data between browsers with JSON backups.
The baseline included the hiragana display fix at `b017ae8`; this phase preserves it.

## Identity and architecture

- Dictionary key: JMdict entry ID plus normalized headword and selected lemma
  reading, percent-encoded by `vocabularyId()`. Inflected surfaces resolve to this
  same identity; distinct entries/readings remain separate.
- Fallback key: normalized token lemma plus supplied reading. No guessed
  deinflection or automatic fallback-to-dictionary migration.
- `VocabularyStateService` separates components from persistence. Its web adapter
  creates database `yomustory.learner.v1`, version 1, store `vocabulary`, key `id`.
  Dictionary storage remains in its existing independent database.
- Progress stays in `yomustory.reader.progress.v1`; no migration/reset. Optional
  `updated_at` supplements existing records for merge conflicts.
- Preferences now persist in `yomustory.reader.preferences.v1`: furigana, text size
  and update timestamp. Translation visibility remains per reading session.

## UI and backups

Spanish status controls appear for each dictionary result, including additional
ambiguous entries, and for unresolved token fallbacks. Learning words have a
subtle dotted underline; known words keep normal styling. Matching occurrences
update immediately. The global furigana toggle continues to display hiragana.

Vocabulary navigation provides counts, status filters, normalized search,
50-row pagination, row-level reclassification and export/import controls. List
rows use saved learner data rather than querying definitions. Reader indicators
resolve only distinct tracked token queries through the dictionary cache/index.

The portable UTF-8 JSON backup has `app: "YomuStory"`, `backup_version: "1.0"`,
`exported_at`, `vocabulary`, `reading_progress` and `preferences`. It contains no
stories, dictionary definitions/assets or caches. Export/context downloads only
start on explicit clicks; import only reads a selected file and shows a preview.

Every imported record, canonical identity, status, UTC timestamp, duplicate ID,
preference and version validates before writing. Maximum file size is 25 MiB,
with at most 100,000 records per collection. Merge keeps newer timestamps; ties
keep current records. Progress falls back to `last_opened` for legacy timestamps.
Replacement requires a native confirmation and replaces all three learner data
categories. Vocabulary-only clearing is separately confirmed and retains progress.

Vocabulary writes are transactional. Progress/preferences are staged with rollback
if either local write or IDB commit fails. UI changes follow successful persistence.
This is tested for preference failure and a later IDB abort. There is no shared
crash-atomic transaction across IndexedDB and localStorage.

`exportLearnerContext()` supplies known/learning word arrays for future generation.
The generation prompt uses a supplied current context instead of static profile
example vocabulary, retaining profile configuration. No profile files are rewritten,
LLM calls added, cloud uploads performed, or analytics/telemetry introduced.

## Files created

- `reader/src/lib/vocabulary.ts`: identities, model, service boundary, merge/context.
- `reader/src/lib/vocabularyStorage.ts`: separate IndexedDB persistence/subscriptions.
- `reader/src/lib/preferences.ts`: persistent reader settings.
- `reader/src/lib/backup.ts`: portable validation, merge, import/export coordination.
- `reader/src/components/LearnerState.tsx`: live context, actions and reader indicators.
- `reader/src/components/VocabularyPage.tsx`: vocabulary management and backup UI.
- `reader/src/lib/learner.test.ts`: persistence, identity, validation and rollback tests.
- `reader/src/components/VocabularyState.test.tsx`: reader/list/file/confirmation flows.
- `reader/src/test/backups/valid.json`
- `reader/src/test/backups/invalid-version.json`
- `reader/src/test/backups/malformed.json`
- `reader/src/test/backups/merge-conflict.json`
- `docs/YOMUSTORY_VOCABULARY_BACKUP_V1_PROMPT.md`: preserved request.
- `docs/VOCABULARY_BACKUP_V1_REPORT.md`: this report.

## Files modified

- `reader/src/App.tsx`: service wiring, navigation, preferences and backup staging.
- `reader/src/components/ReaderPage.tsx`: settings and vocabulary indicators.
- `reader/src/components/StorySentence.tsx`: indicator propagation.
- `reader/src/components/JapaneseText.tsx`: subtle learning appearance.
- `reader/src/components/DictionaryDefinition.tsx`: per-entry status controls.
- `reader/src/components/VocabularySheet.tsx`: unresolved-word controls.
- `reader/src/lib/progress.ts`: backward-compatible optional update timestamp.
- `reader/src/lib/types.ts`: progress timestamp type.
- `reader/src/styles.css`: matching visual language, touch sizes and responsive UI.
- `README.md`: setup, data boundaries, backup rules, privacy and limitations.
- `prompts/STORY_GENERATION_PROMPT.md`: authoritative optional vocabulary context.
- `.gitignore`: learner backup/context exports excluded from repository commits.

Stories, content schemas, manifests, static profiles, dictionary source/build assets
and backend implementations are unchanged. No dependencies were added.

## Validation and limitations

- All five stories and the example profile validate; deterministic manifest builds.
- Python: **75 passed**.
- Frontend: **67 passed**, including all previous 44 and 23 new tests.
- Typechecking and production build pass.
- Backup fixtures are offline; tests cover valid/invalid files, identities,
  homographs, transitions/removal, remount persistence, merges/replacement,
  confirmations, rollback, dictionary isolation and a 2,000-record paginated list.
- Native Edge IndexedDB, status changes and production reload persistence checked.
- With the local server stopped, status updates, real JSON download, file selection
  and merge import worked. The downloaded backup contained vocabulary, preferences
  and two existing progress records; a newer classification survived merging it.
- 820×1180 tablet and 390×844 mobile layouts have no horizontal overflow and use
  44px status/backup controls. Temporary test classification was removed afterward.

Actual iPad/Safari and Android validation are outstanding. Complete offline app-shell
installation, SRS/encounter tracking, automatic mastery, adaptive furigana and cloud
sync are deferred. State remains browser/origin-local. Cross-tab updates need reload.
Removed words have no tombstones, so an older merged backup can restore them.
Fallback identity migration and cross-storage crash atomicity remain limitations.

Recommended next step: adaptive furigana using these classifications, followed by
real iPad/Safari backup/file handling verification before tablet distribution.
