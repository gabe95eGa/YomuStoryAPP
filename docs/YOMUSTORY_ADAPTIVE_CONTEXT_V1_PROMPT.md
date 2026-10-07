# YomuStory — Adaptive Furigana & Learner Context Export V1

You are continuing development of the existing **YomuStoryAPP** repository.

Current stable state reported after Vocabulary State & Backup V1:

- React + TypeScript + Vite reader
- structured Japanese story rendering
- real JMdict-derived local dictionary lookup
- Spanish-first / English-fallback definitions
- vocabulary statuses: Learning / Known / untracked
- learner vocabulary stored separately from dictionary data
- vocabulary library with counts, search and filters
- browser-local reading progress and preferences
- versioned backup format 1.0
- backup export/import with merge and replace modes
- 75 backend tests passing
- 67 frontend tests passing
- typechecking passing
- production build passing
- working tree clean
- current stable commit: `e12a966`

Your task is to implement:

1. **adaptive furigana based on learner vocabulary state**
2. **a compact learner-context export suitable for story generation**

Do NOT redesign the reader, dictionary, backup, or learner-state systems.

---

# 1. First action

Before changing code:

1. inspect the current repository;
2. read README and relevant implementation reports;
3. inspect:
   - furigana rendering
   - reader preferences
   - vocabulary-state service
   - dictionary identity model
   - vocabulary UI
   - backup system
4. run all current backend and frontend tests;
5. run typechecking and production build.

Establish the healthy baseline first.

---

# 2. Main objective

The reader should be able to decide whether furigana is shown for each vocabulary item based on what the learner knows.

The app should support these reader modes:

```text
All furigana
Adaptive
No furigana
```

Recommended behavior:

```text
All
→ show furigana for all eligible kanji tokens

Adaptive
→ Known vocabulary: hide furigana
→ Learning vocabulary: show furigana
→ Untracked vocabulary: show furigana

None
→ hide all furigana
```

This should become the foundation for more advanced learner-aware reading later.

---

# 3. Preserve existing global behavior

If the current app has a simple furigana boolean, migrate it safely to a mode preference.

Existing users must not unexpectedly lose their preference.

Suggested model:

```ts
type FuriganaMode = "all" | "adaptive" | "none";
```

If migration is needed:

```text
old true  → all
old false → none
```

Document and test the migration.

---

# 4. Adaptive logic

The adaptive decision must use the same stable vocabulary identity already implemented for learner vocabulary.

Do NOT attempt to match words only by surface text.

Conceptual function:

```ts
shouldShowFurigana(token, vocabularyStatus, mode)
```

Expected behavior:

```text
mode = all
eligible token → true

mode = none
→ false

mode = adaptive + known
→ false

mode = adaptive + learning
→ true

mode = adaptive + untracked
→ true
```

For tokens that cannot be mapped reliably to learner vocabulary:

```text
adaptive → show furigana
```

Prefer helping rather than hiding uncertain information.

---

# 5. Kana-only tokens

Do not show meaningless furigana on tokens containing only kana.

Examples:

```text
これ
です
から
```

should not render redundant ruby.

Existing behavior should remain intact.

---

# 6. Mixed kanji/kana words

Preserve the current rendering strategy for mixed words.

Examples:

```text
食べる
取り扱う
```

Adaptive mode decides whether furigana is visible.

Do not redesign the furigana segmentation engine unless required.

---

# 7. Reader UI

Replace or upgrade the current furigana control so the learner can easily choose:

```text
Furigana
○ All
● Adaptive
○ None
```

The exact visual interaction may be:

- compact dropdown;
- segmented control;
- small reader settings sheet.

Keep the main toolbar uncluttered.

Adaptive should become the recommended/default mode for a learner who uses vocabulary tracking.

However, be cautious about changing existing preferences automatically.

---

# 8. Immediate state response

If the learner changes a word from:

```text
Learning → Known
```

while reading in Adaptive mode, its furigana should disappear immediately where practical.

Likewise:

```text
Known → Learning
```

should reveal furigana.

No page reload should be required.

If the same vocabulary item occurs several times in the visible story, all instances should update consistently.

---

# 9. Learning indicator interaction

Preserve the existing subtle indicator for Learning vocabulary.

Adaptive furigana and vocabulary indicators are separate features.

Do not create excessive highlighting.

The Japanese text must remain visually clean.

---

# 10. Optional temporary reveal

If straightforward, implement a useful interaction for Adaptive mode:

A known word whose furigana is hidden may temporarily reveal its reading through a deliberate interaction, such as:

- tap/click vocabulary sheet;
- long press;
- existing word interaction.

Do NOT create a complicated gesture system.

The vocabulary sheet already provides the reading, so no additional feature is required if this would add complexity.

---

# 11. Performance

Do not perform one IndexedDB query per rendered token if avoidable.

A story may contain many tokens.

Use an efficient strategy such as:

```text
collect vocabulary identities in story
→ batch/load statuses
→ keep status map in reader state
→ render
```

or another architecture compatible with the current codebase.

Changing a word status should update the status map incrementally.

Adaptive furigana should not noticeably slow story rendering.

---

# 12. Learner context export

Implement a separate export intended specifically for story generation.

This is NOT the same as the full backup file.

Call it conceptually:

```text
Learner Context
```

The output should be small, readable and suitable for:

- Codex;
- ChatGPT;
- Ollama;
- another future story generator.

---

# 13. Context export format

Create a versioned format.

Example:

```json
{
  "context_version": "1.0",
  "generated_at": "2026-10-07T00:00:00Z",

  "language": {
    "current_level": "N4",
    "target_level": "N3"
  },

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
  ],

  "preferences": {
    "preferred_topics": [],
    "generation_preferences": {}
  }
}
```

Adapt to existing profile data where appropriate.

The export must not expose unnecessary internal IDs unless useful.

---

# 14. Context export purpose

The generated file should answer:

```text
What does this learner already know?
What is this learner currently learning?
What level are they?
What should future stories reinforce?
```

It should NOT contain:

- full dictionary entries;
- reading-progress database internals;
- backup metadata;
- story JSON;
- large caches;
- irrelevant browser settings.

---

# 15. Learner profile integration

The project already has a learner-profile format.

Avoid creating a competing profile system.

Determine the cleanest composition of:

```text
static learner profile
+
runtime vocabulary state
=
generation context
```

For example:

```text
current level / target / interests
← profile

known & learning vocabulary
← learner runtime state
```

If necessary, create a service that composes them.

Do not require manually updating `learner-profile.example.json` every time a word is learned.

---

# 16. Generation context service

Create a clear boundary, conceptually:

```ts
interface LearnerContextService {
  buildContext(): Promise<LearnerGenerationContext>;
  exportContext(): Promise<Blob | string>;
}
```

Names may differ.

Keep this independent from any AI provider.

No OpenAI API.

No local LLM integration yet.

---

# 17. Context size

Known vocabulary may eventually contain thousands of words.

Do not assume the generation context must always dump everything blindly.

For V1:

- support full export;
- structure the code so later we can generate compact subsets.

Optionally support a summary such as:

```json
{
  "known_vocabulary_count": 850,
  "learning_vocabulary_count": 47
}
```

Do not prematurely build advanced sampling.

---

# 18. Optional context preview

Add a simple user-facing way to:

```text
Export learner context
```

Optionally allow previewing basic counts:

```text
Known: 318
Learning: 42
Target level: N3
```

The user does not need to edit JSON manually.

---

# 19. File naming

Use a clear filename such as:

```text
yomustory-learner-context-2026-10-07.json
```

Use a deterministic safe date format.

---

# 20. Distinguish backup vs learner context

The UI and documentation must clearly distinguish:

### Backup

Used to restore YomuStory user data.

Includes:

- vocabulary state
- progress
- preferences

### Learner Context

Used to inform story generation.

Includes:

- learning level
- known vocabulary
- learning vocabulary
- generation-relevant profile information

A Learner Context file is NOT a restore backup.

Do not allow it through the backup import workflow.

---

# 21. Future story generation compatibility

Prepare for a future workflow:

```text
Learner Context
       ↓
Story generation prompt
       ↓
Codex / LLM
       ↓
YomuStory JSON
       ↓
validation
       ↓
library
```

The learner-context file should be easy for the existing `STORY_GENERATION_PROMPT.md` to consume later.

Update that prompt/documentation if necessary, but do NOT start calling an LLM.

---

# 22. Future adaptive difficulty

Structure the context so future versions can include:

```text
recently encountered words
weak vocabulary
grammar status
reading performance
```

Do not implement these now unless already available.

---

# 23. Existing backup compatibility

The existing Backup Format 1.0 must continue to work.

If the furigana preference changes from boolean to enum:

- update backup serialization appropriately;
- maintain backward import compatibility with Backup 1.0 where possible;
- migrate old boolean preferences safely.

Do not unnecessarily create Backup Format 2.0 if the current format can support the change compatibly.

If a version change is genuinely required, document it and provide migration.

---

# 24. Offline requirement

Everything in this phase must work offline:

- adaptive furigana;
- vocabulary-state lookup;
- preference changes;
- learner-context export.

No network dependency.

---

# 25. Touch / iPad

Ensure furigana mode controls work cleanly on touch.

Do not rely on hover.

Adaptive rendering must work responsively at mobile/tablet widths.

Actual iPad Safari testing should only be claimed if it is genuinely performed.

---

# 26. Tests

Preserve all existing backend/frontend tests.

Add tests for at least:

### Furigana

- All mode shows eligible furigana
- None mode hides it
- Adaptive + Known hides it
- Adaptive + Learning shows it
- Adaptive + untracked shows it
- kana-only tokens do not gain redundant furigana
- vocabulary status update immediately changes adaptive behavior
- old boolean preference migrates correctly

### Learner context

- known vocabulary exported correctly
- learning vocabulary exported correctly
- statuses are not mixed
- learner profile fields are incorporated
- export excludes dictionary data
- export excludes reading-progress internals
- generated JSON validates
- context export works offline

### Backup

- old backups remain importable
- new furigana preference survives export/import

Do not make tests depend on network access.

---

# 27. Documentation

Update README and relevant docs.

Explain:

- furigana modes;
- adaptive behavior;
- unknown-word fallback;
- learner-context purpose;
- backup vs learner context;
- context file structure;
- future story-generation workflow.

Keep previous documentation intact.

---

# 28. Validation before completion

Run all existing backend validation/tests.

Then run:

- all frontend tests;
- typecheck;
- production build.

Everything must pass.

---

# 29. Definition of done

This phase is complete when:

- reader supports All / Adaptive / None furigana modes;
- Adaptive hides furigana for Known words;
- Adaptive shows it for Learning words;
- Adaptive shows it for untracked words;
- vocabulary status changes update reading behavior correctly;
- preferences persist;
- old preference data migrates safely;
- learner context can be exported as JSON;
- exported context contains learner level + known/learning vocabulary;
- backup and learner-context exports remain distinct;
- no AI API is introduced;
- everything works offline;
- all existing functionality remains intact;
- all backend tests pass;
- all frontend tests pass;
- typechecking passes;
- production build passes.

---

# 30. Final report

At completion report:

1. furigana mode model;
2. adaptive decision rules;
3. performance strategy for vocabulary statuses;
4. preference migration;
5. learner-context schema;
6. profile/runtime-state composition;
7. export UX;
8. backup compatibility;
9. files created;
10. files modified;
11. backend tests;
12. frontend tests;
13. typecheck/build result;
14. known limitations;
15. recommended next step.

Do not merely propose the solution.

Implement it fully in the repository.