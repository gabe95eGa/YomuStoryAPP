# YomuStory — Vocabulary State & Backup V1

You are continuing development of the existing **YomuStoryAPP** repository.

Current stable state reported after JMdict Dictionary Integration V1:

- React + TypeScript + Vite reader
- structured Japanese story rendering
- furigana toggle
- sentence translations
- grammar details
- browser-local reading progress
- real local JMdict-derived dictionary lookup
- persistent IndexedDB dictionary index
- lemma-first lookup with reading/POS ranking
- Spanish definitions preferred
- labelled English fallback
- offline dictionary lookup after initialization
- dictionary data kept outside story files
- large dictionary assets kept outside Git
- reproducible pinned dictionary build process
- 75 backend tests passing
- 44 frontend tests passing
- typechecking passing
- production build passing
- working tree clean
- current stable commit: `f82d297`

Do NOT redesign the existing reader or dictionary system unless a real compatibility issue requires it.

Your task is to implement the first real **learner vocabulary state system**.

The user must be able to mark vocabulary as:

- unknown / untracked
- learning
- known

and YomuStory must persist that information independently from stories and dictionary data.

Also implement reliable **export/import backups** of learner-owned local data.

---

# 1. First action

Before modifying code:

1. inspect the entire repository;
2. read `README.md`;
3. inspect the current progress service;
4. inspect the dictionary service and vocabulary sheet;
5. inspect the learner profile schema/example;
6. inspect current IndexedDB/localStorage usage;
7. run all backend and frontend tests;
8. run typechecking;
9. run the production build.

Establish the current healthy baseline first.

Do not ask unnecessary questions.

Resolve minor implementation choices yourself and document them.

---

# 2. Main objective

Add a persistent learner vocabulary state system.

When the learner opens a dictionary entry, they should be able to classify it as:

```text
Learning
Known
```

and later change or remove that classification.

The system must maintain the existing architectural separation:

```text
Story data
Dictionary data
Learner state
Reader UI
Generation system
```

Vocabulary state belongs only to **Learner state**.

It must NOT be written into:

- story JSON;
- JMdict assets;
- manifest.json.

---

# 3. Vocabulary identity

This is one of the most important implementation decisions.

Do not identify learned vocabulary solely by surface form.

For example:

```text
慣れて
慣れた
慣れる
```

must resolve to the same learner vocabulary item.

Prefer a stable key based on dictionary identity where possible.

Recommended conceptual priority:

```text
JMdict entry ID + selected headword/reading
```

or another stable dictionary-derived identifier already available from the current DictionaryService.

If a stable dictionary ID exists, use it.

Provide a fallback identity for tokens that cannot resolve to JMdict.

Document the strategy clearly.

The system should avoid accidental collisions between homographs with different readings or meanings.

---

# 4. Learner vocabulary model

Create an application-level model similar to:

```ts
type VocabularyStatus = "learning" | "known";

interface LearnerVocabularyItem {
  id: string;
  dictionaryEntryId?: string;
  lemma: string;
  reading?: string;
  status: VocabularyStatus;
  createdAt: string;
  updatedAt: string;
}
```

This is only an example.

Adapt to the existing architecture.

Optional useful fields may include:

```text
firstSeenAt
lastSeenAt
timesSeen
sourceStoryId
notes
```

Do NOT add unnecessary complexity yet.

This phase is not an SRS implementation.

---

# 5. Persistence

Persist learner vocabulary locally.

Prefer IndexedDB if that fits the current architecture.

The user already has dictionary data in IndexedDB, but learner-owned data must be stored separately from dictionary assets.

Conceptually:

```text
Dictionary IndexedDB storage
≠
Learner vocabulary storage
```

This separation is required because dictionary data can be rebuilt, while learner state is valuable personal data.

Do not allow dictionary rebuilds to erase learner vocabulary.

---

# 6. Service boundary

Create or extend a dedicated learner-state service.

Conceptually:

```ts
interface VocabularyStateService {
  getStatus(id: VocabularyIdentity): Promise<VocabularyStatus | null>;
  setStatus(id: VocabularyIdentity, status: VocabularyStatus): Promise<void>;
  removeStatus(id: VocabularyIdentity): Promise<void>;
  getAll(): Promise<LearnerVocabularyItem[]>;
}
```

Names may differ based on the existing codebase.

UI components should not read IndexedDB directly.

Keep storage implementation behind the service layer.

---

# 7. Vocabulary sheet UX

Upgrade the existing vocabulary sheet.

For a resolved word, show clear actions:

```text
慣れる
なれる

acostumbrarse

[Learning] [Known]
```

The current state should be visually clear.

Suggested behavior:

### Untracked

Both actions available.

### Learning

Learning is selected.

Allow:

```text
Mark as Known
Remove from learning
```

### Known

Known is selected.

Allow:

```text
Move to Learning
Remove status
```

Keep the interaction compact.

Do not clutter the definition sheet.

---

# 8. Immediate updates

Status changes must update the UI immediately.

If the same vocabulary item appears several times in the same story, all visible instances should reflect the current learner state where relevant.

Avoid requiring a page refresh.

---

# 9. Word appearance in the reader

Introduce subtle visual behavior for learner vocabulary.

Do NOT aggressively highlight every word.

Recommended:

### Learning vocabulary

A subtle indicator may be shown.

Examples:

- light underline;
- small marker;
- soft accent.

### Known vocabulary

Normally render like ordinary Japanese.

Do not make known words visually noisy.

The main reading experience must remain clean.

---

# 10. Adaptive furigana foundation

Do NOT fully implement the final adaptive furigana system yet unless it is trivial.

However, structure vocabulary state so the next phase can support rules such as:

```text
known vocabulary → hide furigana
learning vocabulary → show furigana
unknown vocabulary → configurable
```

The current global furigana toggle must continue working.

Do not remove it.

---

# 11. Vocabulary management screen

Add a simple vocabulary library accessible from the application.

It should display at least:

- word / lemma;
- reading;
- status;
- optional primary meaning if efficiently resolvable;
- updated date if useful.

Allow filtering:

```text
All
Learning
Known
```

A text search is desirable if straightforward.

Keep the screen simple.

No advanced analytics are required.

---

# 12. Vocabulary counts

Show basic totals:

```text
Learning: 42
Known: 318
```

These values should derive from learner state, not hardcoded metadata.

Avoid turning this into a statistics dashboard.

---

# 13. Word encounters

If straightforward within the current architecture, track basic encounters.

For example:

```ts
timesSeen
lastSeenAt
```

An encounter may be recorded when a learner opens the vocabulary sheet for a token.

Do NOT inflate counts merely because a word happens to exist in a loaded story.

If encounter tracking introduces significant complexity, leave it for a later phase and document that choice.

---

# 14. Export backup

Implement a user-controlled backup export.

The user should be able to download a portable JSON file containing learner-owned state.

Example filename:

```text
yomustory-backup-2026-10-07.json
```

The backup should include at minimum:

- backup format version;
- export timestamp;
- learner vocabulary state;
- reading progress/completion state;
- reader preferences worth preserving.

Do NOT include:

- full JMdict dictionary assets;
- story JSON files that can be redownloaded;
- large generated caches.

The backup represents user-owned state, not reconstructable application data.

---

# 15. Backup format

Create a versioned backup format.

Conceptual example:

```json
{
  "backup_version": "1.0",
  "app": "YomuStory",
  "exported_at": "2026-10-07T10:00:00Z",
  "vocabulary": [],
  "reading_progress": [],
  "preferences": {}
}
```

Do not rely on implementation-specific IndexedDB internals.

The backup format should be intentionally portable.

Document it.

---

# 16. Import backup

Allow the user to import a YomuStory backup JSON.

Before modifying learner data:

1. parse the file;
2. validate its structure;
3. validate supported version;
4. reject malformed backups safely.

Never partially import malformed data.

---

# 17. Import behavior

For V1, offer a clear merge strategy.

Preferred options:

```text
Merge with current data
Replace current learner data
```

If both are implemented:

### Merge

Use deterministic conflict resolution.

Recommended:

```text
same vocabulary identity
→ keep the most recently updated record
```

### Replace

Require a clear confirmation before deletion.

Do not erase dictionary assets or story content.

Only learner-owned state should be replaced.

---

# 18. Backup safety

Import/export must preserve:

- Unicode Japanese text;
- timestamps;
- vocabulary identities;
- statuses;
- reading progress.

Malformed imported data must never corrupt the existing database.

Prefer validating the entire import before applying any writes.

If applying writes fails, avoid leaving learner state partially replaced where practical.

---

# 19. Browser storage migration

The application already stores reading progress locally.

Move or consolidate learner-owned state only if it improves the architecture.

Do not lose existing Reader V1 progress.

If storage changes are necessary:

1. create a migration;
2. preserve existing progress;
3. test the migration;
4. document it.

A normal application update must not silently reset completed stories.

---

# 20. Learner profile relationship

The project already contains a learner profile format.

Clarify the distinction between:

### Profile configuration

```text
current JLPT level
target JLPT level
interests
generation preferences
```

and:

### Runtime learner state

```text
known vocabulary
learning vocabulary
reading completion
reader preferences
```

Avoid two competing sources of truth.

If appropriate, update the profile format/documentation so future story generation can consume an exported vocabulary snapshot without manually duplicating state.

Do not force the current frontend to rewrite static profile files.

---

# 21. Future generation integration

Prepare for a future function like:

```ts
exportLearnerContext()
```

that can generate a compact representation such as:

```json
{
  "known_vocabulary": [
    {
      "lemma": "仕事",
      "reading": "しごと"
    }
  ],
  "learning_vocabulary": [
    {
      "lemma": "慣れる",
      "reading": "なれる"
    }
  ]
}
```

This will later be passed to the story-generation pipeline.

Do not implement LLM calls.

Do not require an AI API.

---

# 22. Privacy

All learner state remains local in this phase.

No automatic cloud upload.

No analytics.

No telemetry.

No external synchronization.

Export happens only when the user explicitly requests it.

Import happens only when the user selects a file.

---

# 23. Offline behavior

Vocabulary state management, vocabulary library, export and import must work offline.

Do not introduce a network dependency.

---

# 24. Reader integration

Existing Reader behavior must remain functional:

- story library;
- story loading;
- furigana;
- dictionary lookup;
- translations;
- grammar;
- completion;
- resume;
- responsive layout.

Vocabulary state enhances the reader rather than replacing any existing behavior.

---

# 25. Tests

Preserve all current tests.

Add meaningful tests for at least:

- marking a word Learning;
- marking a word Known;
- changing Learning → Known;
- changing Known → Learning;
- clearing status;
- persistence across reload/service recreation;
- stable vocabulary identity;
- homograph/readings where relevant;
- vocabulary list filtering;
- backup export;
- valid backup import;
- invalid backup rejection;
- merge behavior;
- replace behavior;
- preservation of reading progress;
- dictionary rebuild not deleting learner state.

Tests should not depend on network access.

---

# 26. Backup test fixture

Add small backup fixtures representing:

```text
valid backup
invalid version
malformed backup
merge conflict
```

Keep them small and deterministic.

---

# 27. UI navigation

Add a simple route/navigation entry for:

```text
Vocabulary
```

and optionally:

```text
Settings / Data
```

for backup controls.

Do not overbuild navigation.

Possible structure:

```text
Library
Vocabulary
```

Backup controls may live inside Vocabulary or a small Settings page.

Choose whichever best fits the current UI.

---

# 28. Visual consistency

Match the existing Reader V1 visual language.

Do not introduce a completely different component style.

Maintain:

- readability;
- restrained color;
- generous spacing;
- tablet/mobile usability.

Vocabulary management is secondary to reading.

---

# 29. iPad / touch considerations

Ensure:

- status buttons are touch-friendly;
- vocabulary list rows are not tiny;
- import/export controls work with browser file handling;
- vocabulary sheet actions work without hover.

Do not claim full iPad validation unless actually tested on Safari.

---

# 30. Future Android compatibility

Keep the learner-state abstraction portable.

The future Android/Capacitor app may use native SQLite or another persistence mechanism.

Reader components should depend on:

```text
VocabularyStateService
```

not directly on browser-specific APIs.

Do NOT implement Android now.

---

# 31. Data deletion

Provide a controlled way to clear learner vocabulary state.

This action must:

- require explicit confirmation;
- not remove dictionary assets;
- not remove stories.

If reading progress can also be cleared, keep that as a separate choice.

Avoid one dangerous generic “Delete Everything” action.

---

# 32. Performance

The vocabulary library should remain responsive with thousands of entries.

Do not repeatedly resolve the entire JMdict database unnecessarily.

If meanings are displayed in the vocabulary list, use sensible batching/caching.

Do not preload hundreds of thousands of dictionary entries.

---

# 33. Documentation

Update `README.md`.

Document:

- learner-state architecture;
- vocabulary statuses;
- persistence mechanism;
- vocabulary identity strategy;
- backup format;
- export instructions;
- import behavior;
- merge behavior;
- replace behavior;
- privacy/local-only status;
- future cloud-sync path.

Do not remove current reader/dictionary documentation.

---

# 34. Validation before completion

Run all existing backend verification.

Use the repository's actual commands, including the equivalent of:

```powershell
.\.venv\Scripts\python.exe tools/validate_stories.py
.\.venv\Scripts\python.exe tools/build_manifest.py
.\.venv\Scripts\python.exe -m pytest
```

Then run:

- frontend tests;
- typecheck;
- production build.

All must pass.

---

# 35. Definition of done

Vocabulary State & Backup V1 is complete when:

- a dictionary word can be marked Learning;
- a dictionary word can be marked Known;
- status persists locally;
- status can be changed/removed;
- stable dictionary-based identity is used where available;
- vocabulary can be browsed separately;
- Learning/Known counts work;
- backup can be exported;
- backup can be imported;
- malformed backup cannot corrupt state;
- reading progress is included in backup;
- dictionary assets are excluded from backup;
- learner state remains independent from stories and JMdict;
- existing Reader features still work;
- all backend tests pass;
- all frontend tests pass;
- typecheck passes;
- production build passes.

---

# 36. Final report

At completion, report:

1. vocabulary identity strategy;
2. learner-state storage architecture;
3. database/storage changes;
4. vocabulary UX changes;
5. backup format;
6. export/import behavior;
7. merge conflict strategy;
8. migration performed, if any;
9. files created;
10. files modified;
11. backend test result;
12. frontend test result;
13. typecheck/build result;
14. known limitations;
15. recommended next step.

Do not merely describe the solution.

Implement it fully in the repository.