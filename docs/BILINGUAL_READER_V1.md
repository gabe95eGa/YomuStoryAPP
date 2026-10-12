# Bilingual reader and fetch recovery

The reported `Failed to fetch` was reproduced in the open localhost library.
No process was listening on port 5173. Starting `pnpm dev --port 5173 --strictPort`
prepared the 15-story library and restored access after reloading. Localhost needs
this process to remain running; the existing GitHub Pages deployment is independent
of it. Content network errors now explain recovery, retain the retry button and link
to the public site. Returning online triggers a retry. Cancellation still propagates
as cancellation, rather than a misleading connection error. No offline/PWA cache
or always-running Windows service has been introduced.

The header's Spanish/English selector uses a small React context and localStorage
key `yomustory.interface.language.v1`. Spanish remains the initial default.
Document language/title, navigation, library metadata and topic labels, reading
controls, translations, grammar, vocabulary status, backup/import confirmations,
error notices and dictionary presentation follow that choice. Japanese story text,
headwords, kana readings and grammar patterns remain Japanese.

`reader/src/locales/en.json` contains interface translations; the separate
`content.en.json` contains 390 English translations of editorial source strings,
including 247 sentences across all 15 stories. Spanish source strings are stable
catalog keys. Repeated identical editorial text shares a translation. If a Spanish
source changes, update its English key/value and remove the unused key when safe.
If identical wording ever needs different contextual English translations, introduce
context-specific keys at that point. Tests check every published `_es` field, not
just a sample story. Missing future runtime strings fall back to the source text;
published content is covered by CI. No third-party translation service runs at
read time, and no user vocabulary is sent to a translator.

All original story JSON files, tokenization, IDs and manifest stay unchanged. Both
languages share components and learner state. Changing language does not refetch
the story, clear a selected sentence or reclassify a word. The language preference
is separate from the existing versioned backup and learner-context schemas, which
remain compatible. It does not change the learner's confirmed native language or
generation profile. UI language is not included in those existing backups.

JMdict definitions prefer the selected language among the same compatible senses.
An explicit fallback identifies entries without a definition in the chosen language;
the other available language remains expandable. English uses upstream expanded
part-of-speech labels. Reading restrictions, alternative word readings and vocabulary
identity are unchanged. Dictionary annotations may retain upstream language-specific
notes. Full dictionary definitions are not translated or copied into story assets.

Future authoring adds English editorial translations to the same story-generation
pass and catalog. This adds translation/review work, while avoiding duplicate
Japanese generation, tokenization, reader implementation or learning records.
Comprehension fields are translated in the catalog; this change does not introduce
a quiz UI where one did not previously exist.

Verification includes the complete existing backend/frontend suites, typecheck,
production build, manifest check, English coverage of all published editorial
fields, language switching/persistence with unchanged stored progress, actual
English dictionary senses, fetch failure/retry and cancellation.
