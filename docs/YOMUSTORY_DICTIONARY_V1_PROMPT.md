# YomuStory — JMdict Dictionary Integration V1

You are continuing development of the existing **YomuStoryAPP** repository.

Current stable state reported after Reader V1:

- React + TypeScript + Vite reader
- structured Japanese story rendering
- furigana toggle
- sentence translation reveal
- vocabulary sheet
- grammar details
- browser-local resume and completion state
- separate content, dictionary, and progress services
- deterministic story content copying
- 69 backend tests passing
- 25 frontend tests passing
- type checking passing
- production build passing
- existing stories, schemas, and backend unchanged

The current vocabulary sheet only has the information already embedded in YomuStory token data.

Your task is to implement the first real **Japanese dictionary integration** using **JMdict-derived data**, while preserving the existing architecture.

Do NOT redesign Reader V1.

---

# 1. First action

Before changing anything:

1. inspect the entire repository;
2. read `README.md`;
3. inspect the current dictionary service abstraction;
4. inspect token types and the vocabulary sheet;
5. inspect at least two story JSON files;
6. run all current backend and frontend tests;
7. run type checking and production build.

Establish the current healthy baseline before modifying code.

Do not ask unnecessary questions.

Make reasonable implementation decisions and document them.

---

# 2. Main objective

When the user taps a Japanese lexical token such as:

```text
慣れて
```

with:

```json
{
  "surface": "慣れて",
  "lemma": "慣れる",
  "reading": "なれて"
}
```

the reader should resolve the dictionary form:

```text
慣れる
```

against a local JMdict-derived dictionary and display useful definitions.

The intended user experience is approximately:

```text
慣れて

慣れる
なれる

acostumbrarse
acostumbrarse a
llegar a acostumbrarse

Verb · ichidan
N3          [if available from a separate source]

[Learning status — future]
```

Do not fabricate dictionary information.

---

# 3. Architectural rule

Maintain the existing separation:

```text
Story data
Dictionary data
Learner state
Reader UI
Generation system
```

Dictionary definitions do NOT belong in YomuStory story files.

Stories should continue storing lightweight token information such as:

```json
{
  "surface": "慣れて",
  "lemma": "慣れる",
  "reading": "なれて"
}
```

The reader should perform:

```text
token lemma
    ↓
DictionaryService
    ↓
local dictionary index
    ↓
dictionary entries
```

---

# 4. Dictionary source

Use a legitimate JMdict-derived data source suitable for local use and redistribution under its applicable license.

Before implementation:

1. identify the exact source;
2. document its license;
3. document attribution requirements;
4. avoid scraping Jisho;
5. avoid making runtime requests to Jisho;
6. avoid relying on an unofficial public API.

Prefer a reproducible download/build process instead of manually committing opaque data.

Possible approaches include:

- official JMdict XML transformed during a build/import step;
- a maintained JMdict JSON distribution;
- another legitimate structured distribution that clearly derives from JMdict.

Choose the simplest robust option.

---

# 5. Spanish and English meanings

Spanish is the user's primary explanation language.

Where JMdict provides Spanish glosses, prefer them.

If Spanish definitions are unavailable for a specific entry:

1. fall back to English;
2. clearly indicate the language internally;
3. do NOT machine-translate definitions at runtime;
4. do NOT require an AI API.

Preferred priority:

```text
Spanish
↓
English fallback
```

Design the result format so more languages could be supported later.

---

# 6. Do not bundle unnecessary data

JMdict is large.

Do not blindly load the entire source file into React memory on every page load.

Design for:

- fast lookup;
- reasonable application size;
- offline use;
- future Android packaging.

Evaluate an efficient local representation.

Good candidates may include:

```text
SQLite
IndexedDB
prebuilt indexed JSON chunks
compact generated lookup files
```

Choose based on the current web architecture.

The implementation should remain compatible with a future Android/Capacitor version.

---

# 7. Recommended service boundary

Preserve or improve the existing dictionary abstraction.

Conceptually:

```ts
interface DictionaryService {
  lookup(query: DictionaryQuery): Promise<DictionaryResult[]>;
}
```

A query should be able to provide:

```ts
{
  lemma?: string;
  surface?: string;
  reading?: string;
}
```

Prefer lookup priority approximately:

```text
exact lemma + compatible reading
↓
lemma
↓
surface
↓
reading-assisted fallback
```

Do not make results depend only on literal surface form because Japanese words are often inflected.

---

# 8. Dictionary result model

Create a clean application-level model instead of exposing raw JMdict internals directly to UI components.

For example:

```ts
interface DictionaryEntry {
  id: string;
  headword: string;
  readings: string[];
  senses: DictionarySense[];
  partsOfSpeech?: string[];
  common?: boolean;
}
```

And:

```ts
interface DictionarySense {
  glosses: {
    language: "es" | "en";
    text: string;
  }[];
  partsOfSpeech?: string[];
  fields?: string[];
  misc?: string[];
}
```

These structures are examples.

Adapt them if the repository already has suitable models.

The UI should not need to understand raw JMdict XML tags.

---

# 9. Multiple dictionary entries

Japanese words can be ambiguous.

If a lemma matches multiple entries, do not arbitrarily discard valid results.

Rank sensible matches using available information such as:

- lemma/headword equality;
- reading match;
- common-word indicators;
- token reading;
- part of speech when available.

The vocabulary sheet should initially show the best match while allowing access to additional matches where appropriate.

Keep the UI simple.

---

# 10. Vocabulary sheet upgrade

Upgrade the existing vocabulary sheet.

Display, where available:

- tapped surface form;
- dictionary/headword form;
- reading;
- Spanish definition(s);
- English fallback definition(s);
- part of speech;
- common-word indicator if reliably available;
- additional dictionary entries if ambiguous.

Do not overwhelm the user.

Prioritize the first useful meaning.

A good hierarchy is:

```text
慣れて

慣れる
なれる

acostumbrarse

verbo ichidan

Other meanings / entries
```

Avoid displaying raw JMdict abbreviations without human-readable formatting.

---

# 11. Part-of-speech formatting

Map important JMdict grammatical labels into readable UI labels.

Examples:

```text
noun
ichidan verb
godan verb
i-adjective
na-adjective
adverb
expression
particle
auxiliary
```

The internal dictionary model may preserve more detail.

The visible UI should remain understandable.

Do not hardcode only these examples if JMdict provides more types.

---

# 12. Japanese normalization

Implement reasonable normalization for lookup.

Consider:

- hiragana / katakana equivalence where useful;
- inflected surface vs dictionary lemma;
- punctuation;
- whitespace;
- full-width Japanese text;
- reading matching.

Do not attempt to write a full morphological analyzer in the frontend.

The story tokenizer already supplies lemmas.

Use that information first.

---

# 13. Proper names

JMdict should remain the primary vocabulary dictionary.

JMnedict integration is NOT required for this phase.

However, design the service so additional dictionary providers could later be added:

```text
JMdict
JMnedict
custom learner notes
```

Do not tightly couple the UI to a single raw file.

---

# 14. JLPT levels

Do NOT pretend JMdict itself provides authoritative JLPT levels if the selected JMdict source does not contain them.

Keep JLPT metadata conceptually separate.

If existing story target vocabulary contains a level such as:

```text
N3
```

the vocabulary sheet may display that story metadata.

Do not infer or invent JLPT levels from JMdict.

Later we may integrate a separate JLPT/frequency dataset.

---

# 15. Frequency and pitch accent

Do NOT implement frequency ranking or pitch accent in this phase unless the existing dictionary source exposes trustworthy information essentially for free.

They are separate future features.

Prioritize dictionary correctness.

---

# 16. Offline-first requirement

Once dictionary assets have been prepared/downloaded for the application, ordinary dictionary lookup should work without Internet access.

A reading session should not require a network call for every tapped word.

This is important for:

- iPad use;
- future Android APK;
- travel;
- performance.

---

# 17. Dictionary build/import tooling

Create a reproducible process for preparing dictionary assets.

For example:

```text
tools/
    build_dictionary.py
```

or an equivalent TypeScript/Node tool if more appropriate.

The process should conceptually:

```text
JMdict source
    ↓
parse
    ↓
normalize
    ↓
retain required fields
    ↓
build optimized local dictionary assets
    ↓
reader DictionaryService
```

Do not manually curate thousands of dictionary entries.

The build process must be documented.

---

# 18. Repository size

Be careful with repository growth.

Before committing a large generated dictionary artifact:

1. measure its size;
2. consider whether it belongs in Git;
3. consider GitHub size limitations;
4. consider deterministic download/build instead;
5. consider compressed/generated assets.

Do not commit an enormous source XML file without assessing the impact.

If generated dictionary assets are committed for convenience, explain the tradeoff.

---

# 19. Development fallback

If downloading or building the full dictionary makes automated tests cumbersome, provide a tiny dictionary fixture for tests.

Example:

```text
慣れる
仕事
経験
始める
食べる
行く
```

Tests must not require downloading the complete JMdict dataset from the Internet.

Production/local developer setup may use the complete dataset.

---

# 20. Caching

Avoid repeatedly parsing dictionary assets.

Dictionary lookup should become fast after application startup.

If using IndexedDB or another browser database, initialize/import intelligently.

Do not rebuild the entire dictionary on every app launch.

If initialization is required, expose a sensible loading state.

---

# 21. First-run behavior

If the dictionary requires local initialization, provide clear status to the user.

Examples:

```text
Preparing Japanese dictionary…
```

or:

```text
Dictionary unavailable
```

Do not silently fail.

The reader itself should still be capable of showing story token information if the full dictionary is unavailable.

Graceful fallback:

```text
surface
lemma
reading
target status
```

---

# 22. Dictionary attribution

Add an attribution/legal section to documentation.

Include:

- dictionary source;
- project/source name;
- applicable license;
- required copyright notice;
- transformation description if applicable.

If attribution should later be visible inside the app, note this requirement.

Do not omit licensing documentation.

---

# 23. Testing

Preserve all current tests.

Add tests covering at minimum:

- exact lemma lookup;
- lemma + reading matching;
- inflected surface using dictionary lemma;
- Spanish gloss priority;
- English fallback;
- multiple dictionary entries;
- unknown word;
- malformed/unavailable dictionary;
- vocabulary sheet dictionary rendering;
- token click → dictionary lookup;
- fallback to token data if dictionary unavailable.

Use small deterministic fixtures.

Do not make unit tests depend on the full JMdict download.

---

# 24. Performance

Perform a basic performance sanity check.

Dictionary interaction should feel immediate after initialization.

Avoid:

- loading hundreds of MB into JS objects;
- linear scanning the entire dictionary per lookup;
- parsing the full source XML on each application run.

Document the chosen lookup strategy.

---

# 25. Mobile / future Android compatibility

Keep future Capacitor/Android packaging in mind.

Avoid architecture that depends on a desktop-only browser environment.

Separate:

```text
DictionaryService interface
```

from:

```text
Web dictionary storage implementation
```

so a future Android implementation could potentially use SQLite without changing reader components.

Do NOT implement Android now.

---

# 26. Do not break Reader V1

Existing behavior must remain functional:

- library;
- story loading;
- furigana;
- translations;
- grammar details;
- reading progress;
- completion;
- responsive layout.

Dictionary work should enhance token interaction without destabilizing reading.

---

# 27. Validation commands

Before finishing, run all existing backend verification:

```powershell
.\.venv\Scripts\python.exe tools/validate_stories.py
.\.venv\Scripts\python.exe tools/build_manifest.py
.\.venv\Scripts\python.exe -m pytest
```

Then run all frontend:

```text
tests
typecheck
production build
```

using the actual project commands.

All must pass.

---

# 28. README

Update documentation with:

- dictionary source;
- license;
- architecture;
- build/import process;
- how to prepare dictionary assets;
- how dictionary lookup works;
- Spanish → English fallback;
- offline behavior;
- test fixtures;
- current limitations.

Do not remove existing Reader V1 or backend instructions.

---

# 29. Definition of done

Dictionary Integration V1 is complete when:

- tapping a Japanese word performs real local dictionary lookup;
- JMdict-derived definitions are shown;
- Spanish meanings are preferred where available;
- English is used as fallback;
- inflected words resolve using their stored lemma;
- ambiguous entries are handled sensibly;
- dictionary data is separate from story files;
- lookup works offline after setup;
- no paid API is required;
- Jisho scraping is not used;
- dictionary source and license are documented;
- current Reader functionality still works;
- backend tests pass;
- frontend tests pass;
- typecheck passes;
- production build passes.

---

# 30. Final report

At completion, report:

1. exact JMdict source selected;
2. license and attribution requirements;
3. dictionary asset format;
4. approximate full dictionary size;
5. lookup/indexing strategy;
6. files created;
7. files modified;
8. UX changes;
9. all test results;
10. build result;
11. known limitations;
12. recommended next step.

Do not merely describe the solution.

Implement it fully in the repository.