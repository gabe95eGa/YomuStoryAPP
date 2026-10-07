# Adaptive Furigana & Learner Context V1 — implementation report

Implemented 2026-10-07 on the healthy `e12a966` baseline. Baseline checks passed:
75 backend tests, 67 frontend tests, story/profile/manifest validation, typecheck
and production build. The request is preserved in
[YOMUSTORY_ADAPTIVE_CONTEXT_V1_PROMPT.md](YOMUSTORY_ADAPTIVE_CONTEXT_V1_PROMPT.md).

1. **Furigana mode model:** `FuriganaMode = all | adaptive | none`, stored in
   `ReaderPreferences.furigana`. Fresh readers use Adaptive. The compact labelled
   native selector presents Todas, Adaptativa and Ninguna and has a 44px target.
2. **Adaptive rules:** All shows eligible kanji readings; None suppresses ruby;
   Adaptive hides only reliably mapped Known identities. Learning, untracked,
   unavailable and ambiguous words retain help. Pure kana never gains redundant
   ruby. Mixed segmentation, exact surfaces and hiragana display are preserved.
   Known readings remain accessible through the existing word sheet. Learning's
   subtle underline remains independent; an ambiguous first displayed Learning
   entry can retain that marker without suppressing help when marked Known.
3. **Performance:** `StoryStatusIndex` collects unique token query keys once per
   mounted story. Only tracked dictionary lemmas need lookup; identity promises
   are deduplicated and matches cached. A shared bulk learner snapshot produces an
   in-memory status map, reconciling changed keys and retaining map identity when
   unchanged. Status transitions reuse dictionary identities and update all
   matching occurrences without refresh or temporary map clearing. Rendering
   performs no per-token learner IndexedDB queries. The existing learner service
   still reads one bulk snapshot following each committed operation. Unresolved
   dictionary matches can retry after dictionary preparation becomes Ready.
4. **Preference migration:** Existing localStorage version-1 boolean true → All,
   false → None, preserving text size/timestamp and original choice. Migration
   normalizes on load; the next preference write serializes the enum under the
   existing key/envelope. Tests cover both booleans, all enum values, invalid
   values, remount persistence and unchanged progress storage.
5. **Context schema:** New strict Draft 2020-12 schema defines context_version 1.0,
   generated_at, language (native/target language and current/target JLPT band),
   known/learning vocabulary, declared known/learning grammar and relevant profile
   preferences. Words have lemma, reading and optional real dictionary_entry_id
   for homograph distinction. Application IDs, per-word status/timestamps, full
   entries, progress, stories, caches, backup metadata and browser preferences
   are excluded. Arbitrary profile extensions are projected away. Contexts are
   validated before export; deterministic full word selection is isolated for
   later subset policies. No weak-word/performance inference is implemented.
6. **Profile/runtime composition:** `configurationFromProfile()` validates and
   projects the existing profile format; both vocabulary arrays always come from
   a fresh committed browser snapshot. Shipped configuration is the existing N4
   → N3 example profile, explicitly labelled in the UI; its sample words are
   ignored. Personal files are never discovered or copied into public assets.
   `createLearnerContextService(vocabulary, profile)` and App's `contextService`
   allow a future personal-profile adapter without another profile format/store.
   No manual static-profile edits accompany vocabulary changes. Grammar is
   declared configuration, not measured grammar mastery.
7. **Export UX:** A separate Contexto para nuevas lecturas section previews source
   levels and counts. Exportar contexto de aprendizaje downloads pretty UTF-8 JSON
   named `yomustory-learner-context-YYYY-MM-DD.json` from the snapshot's UTC date.
   `buildContext()` returns validated data; `exportContext()` returns JSON text.
   Backup remains in its own section. No network, provider, AI API, or automatic
   upload is involved. The generation prompt now consumes versioned context levels,
   vocabulary, grammar and preferences, with legacy vocabulary-only support.
8. **Backup compatibility:** Format stays 1.0. Old boolean files import through the
   same validation/transaction/merge/replace workflow; new enum preferences survive
   export/import in all three modes. Existing boolean fixtures remain intact.
   The pre-mode reader cannot consume enum backups; restore with this current
   reader. Learner context fails strict backup validation before writes. Existing
   transaction rollback, timestamp rules, size limits and isolation remain intact.
9. **Files created:**
   - `reader/src/lib/furigana.ts`: mode, migration and eligibility decision.
   - `reader/src/lib/tokenStatuses.ts`: conservative identity cache/status index.
   - `reader/src/lib/learnerContext.ts`: configuration projection and context service.
   - `reader/src/lib/adaptive.test.ts`: mode/cache/migration/context/backup tests.
   - `schema/yomustory-learner-context-v1.schema.json`: portable generation schema.
   - `docs/YOMUSTORY_ADAPTIVE_CONTEXT_V1_PROMPT.md`: preserved request.
   - `docs/ADAPTIVE_CONTEXT_V1_REPORT.md`: this report.
10. **Files modified:**
    - `.gitignore`: downloaded dated learner-context files ignored, schema tracked.
    - `README.md`: modes, migration, composition, offline use and export workflow.
    - `prompts/STORY_GENERATION_PROMPT.md`: consume context as data/configuration.
    - `reader/src/App.tsx`: independent injectable context service.
    - `reader/src/components/JapaneseText.tsx`: per-token furigana decision.
    - `reader/src/components/StorySentence.tsx`: forward typed mode.
    - `reader/src/components/ReaderPage.tsx`: compact mode selector/default.
    - `reader/src/components/LearnerState.tsx`: cached reader status hook.
    - `reader/src/components/VocabularyPage.tsx`: separate context section/export.
    - `reader/src/lib/preferences.ts`: enum persistence/boolean migration.
    - `reader/src/lib/backup.ts`: compatible enum normalization, context decoupling.
    - `reader/src/lib/vocabulary.ts`: explicitly named vocabulary context projection.
    - `reader/src/styles.css`: 44px selector and mobile/section layout.
    - `reader/src/App.test.tsx`: preserve global on/off coverage through modes.
    - `reader/src/components/VocabularyState.test.tsx`: preserve flows, test repeated
      adaptive transitions/readings and no lookup repetition.
    - `reader/src/lib/learner.test.ts`: retain backup/persistence coverage for enum
      defaults and explicitly named vocabulary projection.
    Story assets, existing schemas, manifest output, profiles, dictionary adapter,
    learner IndexedDB adapter, progress adapter and dependencies are unchanged.
11. **Backend results:** 75 pytest tests passed, including tokenizer integration.
    All five stories validated; profile validated; manifest rebuilt and checked
    with no output change. New downloaded context independently validated with
    Python jsonschema Draft202012Validator and FormatChecker.
12. **Frontend results:** 87 tests in eight files passed (67 existing cases retained
    with intentional control/model assertions updated, plus 20 new cases). Coverage
    includes all modes/statuses/kana; identity uncertainty and homographs; immediate
    repeated-word transitions; no per-token learner queries/repeated dictionary
    queries; old preference and backup migration; full new preference round trips;
    profile projection and exclusions; current committed offline context; strict
    JSON validation; 2,500-word complete deterministic export; backup rejection.
13. **Typecheck/build/browser:** `pnpm typecheck` passed; `pnpm build` passed with
    134 modules, JS 430.26 kB (128.21 kB gzip), CSS 18.18 kB (4.59 kB gzip).
    Edge QA checked live All → Adaptive with the previous choice preserved,
    Learning → Known hiding both repeated 慣れ readings, and Known → Learning
    revealing both immediately with the local server stopped. An offline native
    JSON download was verified: 1,024 bytes, N4 → N3, one temporary QA learning
    word, schema-valid, no restore/progress/cache data. At 390×844 and 820×1180,
    actual content widths were 375/805px due to scrollbar space, with no horizontal
    overflow. Mode selector measured 44px high. Production preview loaded correctly
    and real file selection rejected context as a backup without changes. Temporary
    vocabulary was removed; the original All preference was restored. Existing
    completions/resume records were retained. The development server is left running
    on localhost:5173. Screenshots are local QA evidence under ignored `.tmp/`.
14. **Known limitations:** Full offline installation/reloading still needs a future
    shell/content cache; these features work offline in an already loaded app with
    needed dictionary entries installed. Conservative unresolved Known words may
    retain furigana. Profile editor/chooser, inferred grammar/vocabulary weakness,
    SRS, sampling, cloud sync, cross-tab live changes and deletion tombstones are
    deferred. Existing IDB/localStorage backup crash-atomicity limitation remains.
    Actual iPad Safari has not been tested; Edge viewport checks are not that test.
    Full exports can become large as thousands of vocabulary records accumulate.
15. **Recommended next step:** Use an exported learner context with the updated
    generation prompt to create and linguistically review a small reinforcement
    story batch, then validate and rebuild the library. Add an existing-format
    personal-profile chooser and perform real iPad Safari validation before expanding
    adaptive difficulty or offline installation. No LLM was called in this phase.
