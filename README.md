# YomuStory content system V1

A structured Japanese graded-reading content library and local Python tooling.
Stories target approximately JLPT N4 moving toward N3, with Spanish translations
and explanations. Content is original fictional demo material. No paid API,
running LLM, Docker, database, or cloud service is needed to validate or read it.

The human-readable source of truth is [YOMUSTORY_SPEC.md](YOMUSTORY_SPEC.md).
[CODEX_MASTER_PROMPT_YOMUSTORY.md](CODEX_MASTER_PROMPT_YOMUSTORY.md) defines this
phase: content tooling. The full reader application comes later.

## Setup

Use Python 3.11 or newer from a source checkout:

```shell
python -m venv .venv
```

On Windows PowerShell, install the base and test dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

On macOS/Linux use `.venv/bin/python` in place of `.venv\Scripts\python.exe`.
Commands below use `python` for an activated environment. On this Windows
checkout, Python is already available in `.venv`; use
`.\.venv\Scripts\python.exe` directly without activating it or changing PATH.

Install the optional local tokenizer when authoring new content:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,tokenizer]"
```

`requirements-dev.lock.txt` records the exact third-party versions used for the
initial verification, including the optional tokenizer. To reproduce them:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
```

Initial installation downloads dependencies. After installation, all validation,
manifest generation, tests, and local tokenization run offline. The tokenizer
dictionary is roughly a 72 MB download and stays in the environment, outside Git.
Run tools from the source checkout; this V1 does not package the content library
or its schemas into a standalone wheel.

## Validate, index, and test

```shell
python tools/validate_stories.py
python tools/validate_stories.py stories/work/work_001.json
python tools/validate_profile.py
python tools/build_manifest.py
python tools/build_manifest.py --check
python -m pytest
```

The validator never changes stories. It checks JSON Schema and semantic rules,
then exits nonzero on failure. Without file arguments it scans `stories/`
recursively. Explicit file arguments validate that selected set; run the full
library check before publication to detect duplicate story IDs across files.
Duplicate JSON keys, invalid dates, NaN/Infinity, and empty libraries are rejected.

The manifest builder validates the entire library first. If any story fails,
it leaves the previous manifest intact and exits nonzero. A successful rebuild
sorts by story ID, includes browsing metadata and relative POSIX paths, and
atomically replaces `manifest.json`. `--check` verifies that the saved manifest
matches the library without writing. Paths default to this checkout, regardless
of the caller's working directory. `--root` supports another library root.

With only base/test dependencies installed, tokenizer integration tests skip.
The complete initial run includes tokenizer dependencies and exercises them.

## Add or generate a story

1. Choose a category under `stories/`: daily, work, travel, japan, relationships,
   cooking, or random. Select an unused lowercase ID such as `work_002`.
2. Create a complete UTF-8 JSON object using the spec, schema, and existing samples.
   Include sentence translations, vocabulary lemmas/readings, grammar annotations,
   and honest generation metadata. Start with `generation.validated: false`.
3. Optionally create a draft under `.tmp/` and enrich its token arrays:

   ```shell
   python tools/tokenize_story.py .tmp/draft.json --output .tmp/enriched.json
   ```

   The input must have otherwise complete story structure. The output must be a
   new file. The tool replaces token arrays on a copy, resets the validation flag,
   validates, and saves only if successful. It never overwrites the source or an
   existing output. Review generated readings and lemmas before publishing.
4. Run the story validator, fix errors, and validate again. Review the language,
   translations, grammar spans, question answers, and difficulty as well.
5. Put the reviewed JSON in its category, run full-library validation, then rebuild
   the manifest and run tests.
6. Review the Git diff, commit, and push to back up the content.

For Codex or another LLM, use
[prompts/STORY_GENERATION_PROMPT.md](prompts/STORY_GENERATION_PROMPT.md). For example:

> Generate 10 new N4–N3 stories using my learner profile, focusing on the learning
> vocabulary and grammar. Follow prompts/STORY_GENERATION_PROMPT.md, validate the
> entire library, fix errors, and rebuild the manifest.

Copy the example to `profiles/learner-profile.local.json` for personal edits,
then run `python tools/validate_profile.py profiles/learner-profile.local.json`.
That personal file is ignored by Git; the example contains no identifying data.
Vocabulary entries are objects with `lemma` and `reading`, plus optional `status`,
`proficiency` (0–1), and `notes`. Grammar entries are objects with `pattern` and
optional `notes`. Preferences guide generation; this V1 does not automatically
measure actual familiar-word proportions or update learner state.

## Architecture and V1 decisions

- **Story data:** immutable reading assets, paragraphs, sentence translations,
  tokens, learning targets, questions, and generation provenance in JSON.
- **Dictionary data:** separate local resources, eventually resolving
  `token.lemma` to JMdict vocabulary, KANJIDIC2 kanji, and JMnedict proper names.
  Optional pitch-accent/frequency datasets also stay separate. Stories contain
  contextual glosses, never full dictionary records or invented dictionary IDs.
- **User state:** a separate profile now and a separate user database later.
- **Reader:** consumes `manifest.json` and story JSON; cache, dictionary cards,
  UI, audio, and progress tracking are later reader work.
- **Generator:** any LLM, Codex, a human, or a future local Ollama workflow.
  Generated output is parsed and validated before publication. No runtime AI is
  required by a future reader.

The specification is a draft with some ambiguities. This implementation keeps
schema version `1.0` and resolves them as follows:

- Comprehension is optional, following the explicit required-field list in §4
  and §20 even though the top-level example includes it.
- Sentence translations are required by this library's semantic policy. §10
  calls them recommended, while the master prompt and the V1 priorities require
  Spanish translations. The schema still permits a sentence without one so the
  format remains faithful; local validation rejects it.
- Story IDs accept the stated lowercase ASCII letters, digits, and underscores;
  `category_number` is recommended, not forced. File and category naming is a
  workflow convention, not an extra format restriction.
- Learning targets contain vocabulary and grammar arrays. Vocabulary requires
  `lemma` and kana `reading`; grammar requires `pattern`. Glosses and approximate
  levels are optional, as in the specification. The listed level bands form the
  V1 enum. Profiles use the same enum.
- Vocabulary usage is checked against token lemmas so inflections count. Grammar
  usage is checked against exact sentence annotation patterns; dictionary-style
  `〜` patterns cannot reliably be matched to raw inflected text. Annotation spans
  must be valid, but a human must assess their linguistic accuracy.
- Every token requires nonempty surface, lemma, and reading. Kana readings are
  checked for Japanese lexical surfaces. Punctuation or other non-Japanese
  surfaces may use a non-kana reading only with `ignore_lookup: true`.
  Tokens may omit function words and punctuation, as in the spec's full example;
  full text coverage is not mandatory. Supplied tokens must occur in order and
  cannot overlap. Sudachi output normally covers all non-whitespace text.
- Offsets always come in pairs, in Unicode code points, inclusive/exclusive.
  Count metadata includes all sentence-text code points, punctuation and spaces,
  excludes titles and separators, and uses `len(text)` in Python.
- Multiple-choice answers reference option IDs; true/false answers are booleans;
  short answers are nonempty strings or lists of accepted strings. The latter two
  shapes were unspecified. They provide model answers for a future reader.
- Unknown extension fields are accepted for forward compatibility. Explicit
  learning-state keys such as `times_seen` remain prohibited in story assets.
  `known_hint`, if supplied, is a static boolean hint, not stored user progress.
- `generation.validated` is a provenance hint, never a trusted validation result.
  Tools always revalidate even if true; validation never updates it automatically.
  Demo files were marked true only after successful checks.
- `manifest.generated_at` is the newest story `generation.created_at` date,
  meaning the content snapshot date. It intentionally does not use wall-clock
  time. Identical content generates identical output across machines and dates.
- A failed build rejects the entire new manifest, preserving the last good one.
  An empty library also fails, avoiding accidental publication of an empty index.
- §32 mentions reader caching/dictionary lookup, but the master prompt explicitly
  limits this phase to content tooling and defers reader/dictionary implementation.
  This repository prepares the data interface for that later phase.

## Local tokenizer and licensing

The optional adapter uses [SudachiPy](https://github.com/WorksApplications/sudachi.rs)
0.6.11 with the core dictionary 20260723 and split mode C. It exports original
surfaces, dictionary forms, katakana readings, and computed code-point offsets.
Versions are pinned because tokenizer/dictionary updates can change segmentation;
regeneration of published stories requires deliberate review.

SudachiPy is Apache-2.0. The [Sudachi dictionary licensing
notes](https://github.com/WorksApplications/SudachiDict#licenses) identify its
Apache-2.0 license and included UniDic/NEologd resources. Read upstream licenses
and notices before redistributing tokenizer dictionary binaries. This repository
stores generated token annotations, not dictionary binaries or definitions.

When Sudachi is unavailable, carefully reviewed generated/manual tokens remain
supported. No custom morphological analyzer is implemented. Unknown readings
produce errors rather than invented annotations. JLPT labels and difficulty are
approximate, and structural validation cannot prove natural Japanese, translation
accuracy, correct dictionary lemmas, or the truth of a comprehension answer.

## GitHub and Git Extensions

The local checkout is a normal Git repository. Git Extensions manages that same
repository and its commit history. GitHub holds the remote copy of committed
content. Commit and push together form the usual backup workflow:

```shell
git status
git add stories manifest.json
git commit -m "Add reviewed stories"
git push
```

In Git Extensions, open this project folder to browse commits, review changes,
and use Commit and Push. Dependencies, temporary drafts, and personal profile
files are ignored. A second local directory or disk backup is not created by
Git Extensions; use a separate backup location if one is needed later.
