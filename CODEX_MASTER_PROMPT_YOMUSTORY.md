# Master Prompt for Codex — YomuStory Content System V1

You are working on a personal Japanese graded-reading project inspired by the reading experience of apps such as Yomu Yomu, but this project must be independently implemented and must not copy proprietary code, branding, text, assets, or private datasets.

The repository contains a file named:

`YOMUSTORY_SPEC.md`

Treat that file as the human-readable source of truth for the story format and architecture.

Your task is to build the first functional version of the **YomuStory content system**: the tooling that stores, validates, indexes, and prepares structured Japanese stories for a future reading application.

Do NOT build the full mobile/web reader UI yet.

---

## 1. Main goal

Create a clean, maintainable content pipeline where:

1. Japanese stories are stored as structured JSON files.
2. Every story follows `YOMUSTORY_SPEC.md`.
3. Stories can be validated automatically.
4. A global `manifest.json` can be rebuilt automatically from valid stories.
5. New stories can be added easily by either:
   - Codex generating them directly;
   - another LLM generating them;
   - a human writing them;
   - a future local model such as Ollama.
6. The system requires no paid API to function.
7. The future reader app can consume the generated JSON without needing an LLM at runtime.

The current target learner is approximately JLPT N4 moving toward N3.

Spanish is the default explanation/translation language.

---

## 2. First action

Before writing code:

1. Read `YOMUSTORY_SPEC.md` completely.
2. Inspect the current repository.
3. Identify any inconsistencies, ambiguities, or implementation risks in the specification.
4. Resolve minor implementation details yourself in the simplest reasonable way.
5. Do not rewrite the architecture unless there is a strong technical reason.
6. If you make an implementation decision not explicitly covered by the spec, document it.

Do not ask unnecessary questions. Make reasonable assumptions and continue.

---

## 3. Scope of this phase

Implement the content backend/tooling only.

### Required

Create or complete:

- YomuStory JSON Schema;
- story directory structure;
- learner profile format;
- story validator;
- manifest builder;
- story-generation helper/instructions;
- sample stories;
- automated tests;
- developer documentation.

### Explicitly out of scope for now

Do NOT build:

- authentication;
- payments;
- production cloud infrastructure;
- mobile application;
- React/Flutter/Swift UI;
- SRS algorithm;
- user accounts;
- text-to-speech;
- AI API integration;
- complex admin dashboard.

Keep the repository prepared for these later, but do not implement them now.

---

## 4. Preferred technical approach

Use **Python 3.11+** for the content tooling unless the existing repository strongly suggests another language.

Prefer standard-library solutions where practical.

Additional small dependencies are acceptable when they clearly improve correctness.

Recommended dependencies may include:

- `jsonschema`
- a lightweight Japanese tokenizer/morphological analyzer if genuinely needed

However:

- do not introduce a large framework;
- do not require Docker;
- do not require a paid cloud service;
- do not require an OpenAI API key;
- do not require an external API simply to validate or read stories.

All basic validation and manifest generation must work locally and offline.

---

## 5. Target repository structure

Use the following structure unless the existing repository makes a small adjustment preferable:

```text
/
├── YOMUSTORY_SPEC.md
├── README.md
├── pyproject.toml
│
├── schema/
│   └── yomustory-v1.schema.json
│
├── stories/
│   ├── daily/
│   ├── work/
│   ├── travel/
│   ├── japan/
│   ├── relationships/
│   ├── cooking/
│   └── random/
│
├── profiles/
│   ├── learner-profile.example.json
│   └── learner-profile.schema.json
│
├── prompts/
│   └── STORY_GENERATION_PROMPT.md
│
├── tools/
│   ├── validate_stories.py
│   ├── build_manifest.py
│   └── story_utils.py
│
├── tests/
│   ├── test_validation.py
│   ├── test_manifest.py
│   └── fixtures/
│
└── manifest.json
```

If you choose a different layout, keep it simple and explain why.

---

## 6. JSON Schema

Create:

`schema/yomustory-v1.schema.json`

It must reflect `YOMUSTORY_SPEC.md` as closely as practical.

Enforce at minimum:

- required top-level fields;
- schema version;
- story ID pattern;
- metadata types;
- allowed JLPT level values;
- difficulty 1–5;
- non-empty titles;
- paragraphs;
- sentences;
- token structure;
- grammar target structure;
- comprehension question structure;
- generation metadata;
- supported question types;
- required values inside multiple-choice questions.

Do not attempt to express semantic rules in JSON Schema when ordinary code is more appropriate.

Use semantic validation for rules such as:

- target vocabulary must actually occur in the story;
- target grammar must actually occur or be annotated;
- sentence IDs must be unique;
- paragraph IDs must be unique;
- question IDs must be unique;
- token offsets must match token surfaces when offsets exist.

---

## 7. Story validator

Implement a CLI tool.

Expected usage should be approximately:

```bash
python tools/validate_stories.py
```

and optionally:

```bash
python tools/validate_stories.py stories/work/work_001.json
```

The validator must:

1. discover all `.json` story files when no specific file is supplied;
2. validate against the JSON Schema;
3. run semantic validation;
4. produce useful human-readable errors;
5. return a non-zero exit code if any story fails;
6. clearly report success when everything passes.

Check at minimum:

- duplicate story IDs;
- duplicate sentence IDs within a story;
- invalid levels;
- empty Japanese text;
- missing translations when expected;
- unused declared target vocabulary;
- malformed target items;
- token `surface`, `lemma`, and `reading`;
- token offsets if supplied;
- invalid comprehension answers;
- inconsistent metadata counts when those counts are present.

If `character_count`, `sentence_count`, or `paragraph_count` are present, verify them.

Do not silently modify broken stories during validation.

---

## 8. Manifest builder

Implement:

```bash
python tools/build_manifest.py
```

It must:

1. validate stories before including them;
2. scan the `stories/` directory recursively;
3. generate a deterministic `manifest.json`;
4. sort stories consistently;
5. expose only metadata required for browsing;
6. include the relative path to each story;
7. never include an invalid story.

Suggested manifest item:

```json
{
  "id": "work_001",
  "title": "新しい仕事",
  "title_es": "El nuevo trabajo",
  "level": "N4-N3",
  "difficulty": 2,
  "estimated_minutes": 6,
  "topics": ["仕事", "日常生活"],
  "path": "stories/work/work_001.json"
}
```

The generated manifest should not depend on the machine on which it is built.

Avoid absolute paths.

---

## 9. Learner profile

Create an extensible learner-profile format.

This profile is NOT part of individual story files.

Create:

- `profiles/learner-profile.example.json`
- `profiles/learner-profile.schema.json`

The profile should support at least:

```json
{
  "profile_version": "1.0",
  "native_language": "es",
  "target_language": "ja",
  "current_level": "N4",
  "target_level": "N3",
  "known_vocabulary": [],
  "learning_vocabulary": [],
  "known_grammar": [],
  "learning_grammar": [],
  "interests": [],
  "preferred_topics": [],
  "avoid_topics": [],
  "generation_preferences": {}
}
```

For vocabulary entries, allow at least:

- lemma;
- reading;
- optional status/proficiency;
- optional notes.

For generation preferences, support values such as:

- default story length;
- desired difficulty;
- maximum new vocabulary;
- desired grammar target count;
- preferred proportion of familiar vocabulary.

Keep this simple enough to edit manually.

---

## 10. Story generation prompt

Create:

`prompts/STORY_GENERATION_PROMPT.md`

This prompt will be reusable with Codex or another LLM.

It must instruct the model to:

1. read the learner profile;
2. choose suitable vocabulary and grammar targets;
3. generate natural Japanese;
4. keep most language comprehensible for an N4→N3 learner;
5. recycle target vocabulary naturally;
6. avoid unnatural sentences created only to force a target word;
7. produce Spanish translations;
8. produce comprehension questions;
9. output a complete YomuStory object;
10. never invent `validated: true` merely because it generated the file;
11. run the validator after generation when operating inside the repository;
12. fix validation errors before considering the story complete.

The prompt must explicitly distinguish:

- generated linguistic content;
- dictionary information;
- user learning state.

The LLM should not fabricate full dictionary data that belongs in JMdict or another dictionary database.

---

## 11. Tokenization strategy

This is important.

For V1, choose the simplest reliable approach that does not make story generation fragile.

The goal is to produce tokens containing:

```json
{
  "surface": "...",
  "lemma": "...",
  "reading": "..."
}
```

You may implement one of these approaches:

### Preferred

Use a mature Japanese tokenizer/morphological analyzer available locally.

### Acceptable temporary fallback

Allow generated token data to be supplied by the LLM, but validate it carefully and structure the code so a real tokenizer can replace this later.

Do not create a custom Japanese morphological analyzer from scratch.

Document the chosen approach.

If a tokenizer dependency introduces licensing or distribution concerns, mention them clearly in the documentation.

---

## 12. Dictionary architecture

Do NOT bundle a giant dictionary into each story.

Prepare the codebase so the future reader can resolve:

```text
token.lemma -> local dictionary lookup
```

Document the intended future sources:

- JMdict for vocabulary;
- KANJIDIC2 for kanji;
- JMnedict for proper names;
- optional pitch-accent/frequency datasets.

For now, a full dictionary importer is NOT required unless it is trivial and clearly useful.

The story system must remain independent from any one dictionary implementation.

---

## 13. Sample stories

Create at least **5 valid sample stories** covering different topics.

Suggested topics:

1. work / restaurant;
2. daily life in Australia;
3. motorcycle day trip;
4. preparing to live in Japan;
5. cooking or shopping.

Target:

- N4-N3;
- difficulty 1–3;
- approximately 300–700 Japanese characters each;
- 3–8 target vocabulary items;
- 1–3 target grammar points;
- 3 comprehension questions where appropriate.

These stories are test/demo content.

Make them natural and useful for a real learner.

Do not include private or identifying personal information.

---

## 14. Tests

Add automated tests for:

- valid story accepted;
- missing required field rejected;
- invalid difficulty rejected;
- duplicate sentence ID rejected;
- unused target vocabulary rejected;
- bad token offset rejected;
- invalid comprehension answer rejected;
- manifest contains valid stories;
- manifest excludes or fails on invalid stories;
- deterministic manifest ordering.

Tests should run with one straightforward command.

Prefer:

```bash
python -m pytest
```

if pytest is used.

---

## 15. Documentation

Update or create `README.md`.

It should explain:

### What this repository is

A structured Japanese graded-reading content library and tooling system.

### How to validate

```bash
python tools/validate_stories.py
```

### How to rebuild the manifest

```bash
python tools/build_manifest.py
```

### How to add a story

Explain:

1. choose category;
2. create JSON;
3. validate;
4. fix errors;
5. rebuild manifest;
6. commit.

### How to generate a story with Codex

Reference:

`prompts/STORY_GENERATION_PROMPT.md`

### Architecture

Briefly explain the separation between:

- story data;
- dictionary data;
- user state;
- reader UI;
- generator.

---

## 16. Quality requirements

Prioritize:

1. correctness;
2. simplicity;
3. readability;
4. maintainability;
5. deterministic behavior.

Avoid:

- premature abstraction;
- unnecessary classes;
- hidden magic;
- complex build systems;
- unnecessary databases;
- paid services;
- hardcoded absolute paths.

Use type hints in Python.

Include docstrings where they materially help.

Functions should be small and testable.

---

## 17. Data safety and versioning

Never overwrite valid existing story content without a reason.

When changing the schema:

- do not silently break old stories;
- update `schema_version`;
- document the migration.

For this phase, remain on:

```text
YomuStory 1.0
```

unless there is a blocking flaw.

---

## 18. Important implementation rule

Do not treat an LLM response as valid merely because it looks correct.

The pipeline must be:

```text
generate
→ parse
→ schema validate
→ semantic validate
→ fix
→ validate again
→ publish
```

Only valid content should enter the manifest.

---

## 19. Desired developer experience

Ultimately I want to be able to ask Codex something like:

> Generate 10 new N4-N3 stories based on my learner profile, focusing on my current learning vocabulary and grammar.

And have Codex:

1. read the profile;
2. generate the stories;
3. store them in appropriate folders;
4. validate them;
5. repair any failures;
6. rebuild the manifest;
7. summarize what was added.

Design the tooling to make that workflow easy.

Do not require me to manually edit every JSON file.

---

## 20. Completion criteria

Do not consider the task complete until:

- `YOMUSTORY_SPEC.md` has been read and followed;
- the JSON Schema exists;
- the learner profile schema and example exist;
- validation tooling works;
- manifest generation works;
- at least 5 sample stories validate;
- tests pass;
- README instructions are complete;
- `STORY_GENERATION_PROMPT.md` exists;
- `manifest.json` has been generated from the valid stories.

At the end, run the relevant validation/tests and report:

1. what you created;
2. architecture decisions made;
3. commands to use;
4. test results;
5. any limitations or future improvements.

Do not just describe what should be built. Implement it in the repository.
