# YomuStory Format Specification

Version: 1.0  
Status: Draft for implementation  
Primary use case: Personal Japanese graded-reading application  
Target learner profile: JLPT N4 → N3

---

## 1. Purpose

YomuStory is a structured content format for Japanese graded-reading stories.

The goal is to separate:

1. **Story generation**
2. **Story storage**
3. **Japanese linguistic data**
4. **User learning progress**
5. **Reader UI behavior**

A story file must contain enough structured information for the application to:

- display Japanese text;
- show sentence translations;
- identify vocabulary items;
- identify grammar targets;
- support furigana;
- support dictionary lookup;
- distinguish target vocabulary from ordinary vocabulary;
- display comprehension questions;
- estimate difficulty and reading time;
- load stories without requiring an AI model at runtime.

The application should not need to reinterpret raw Japanese every time a story is opened.

---

## 2. Design principles

### 2.1 Stories are immutable learning assets

Once published, a story should normally remain unchanged.

If a story must be significantly modified, create a new revision or new story ID.

### 2.2 Linguistic data must not be duplicated unnecessarily

Story JSON files should store only the information needed to render and interpret the story.

Full dictionary definitions should NOT be duplicated inside every story.

Dictionary data should come from separate linguistic resources such as:

- JMdict
- KANJIDIC2
- JMnedict
- optional frequency datasets
- optional pitch-accent datasets

### 2.3 Generated content must be machine-readable

Generated stories must always validate against this specification.

Natural-language output alone is not sufficient.

### 2.4 Spanish is the default explanation language

Japanese is the learning language.

Spanish is the default language for:

- story translations;
- vocabulary glosses;
- comprehension explanations;
- grammar explanations.

English may later be supported as an additional language.

### 2.5 The format must support future extensions

Unknown fields should be ignored by older clients whenever possible.

The `schema_version` field is mandatory.

---

## 3. File format

Each story is stored as UTF-8 JSON.

Recommended extension:

```text
.json
```

Example:

```text
stories/
  work/
    work_001.json
```

---

## 4. Top-level structure

Every YomuStory file MUST contain:

```json
{
  "schema_version": "1.0",
  "id": "work_001",
  "metadata": {},
  "targets": {},
  "content": {},
  "comprehension": {},
  "generation": {}
}
```

Required top-level fields:

- `schema_version`
- `id`
- `metadata`
- `targets`
- `content`
- `generation`

Optional top-level field:

- `comprehension`

---

# 5. Story ID

The `id` field must be unique.

Recommended format:

```text
category_number
```

Examples:

```text
work_001
travel_004
japan_012
daily_021
restaurant_003
```

Rules:

- lowercase ASCII only;
- numbers allowed;
- underscores allowed;
- no spaces;
- once published, IDs should not change.

---

# 6. Metadata

Example:

```json
{
  "metadata": {
    "title": "新しい仕事",
    "title_es": "El nuevo trabajo",
    "summary_es": "Una historia sobre acostumbrarse a un nuevo trabajo en Australia.",
    "level": "N4-N3",
    "difficulty": 2,
    "topics": [
      "仕事",
      "オーストラリア",
      "日常生活"
    ],
    "estimated_minutes": 7,
    "character_count": 640,
    "sentence_count": 18,
    "paragraph_count": 5
  }
}
```

## Required metadata fields

### `title`

Japanese title.

### `title_es`

Natural Spanish title.

### `level`

Approximate learning band.

Allowed examples:

```text
N5
N5-N4
N4
N4-N3
N3
N3-N2
N2
N2-N1
N1
```

For the current application, most generated content should target:

```text
N4-N3
N3
```

### `difficulty`

Integer from 1 to 5.

Suggested interpretation:

```text
1 = easy for current learner
2 = comfortable
3 = moderately challenging
4 = difficult
5 = stretch reading
```

### `topics`

Array of topic labels.

Prefer Japanese labels.

Examples:

```json
[
  "仕事",
  "料理",
  "旅行",
  "日本生活",
  "人間関係"
]
```

### `estimated_minutes`

Estimated reading time for the target learner.

---

## Optional metadata fields

- `summary_es`
- `character_count`
- `sentence_count`
- `paragraph_count`
- `series`
- `series_order`
- `tags`
- `cover_asset`
- `author_label`

---

# 7. Learning targets

The `targets` object defines the pedagogical purpose of the story.

Example:

```json
{
  "targets": {
    "vocabulary": [
      {
        "lemma": "慣れる",
        "reading": "なれる",
        "meaning_es": "acostumbrarse",
        "level": "N3"
      },
      {
        "lemma": "経験",
        "reading": "けいけん",
        "meaning_es": "experiencia",
        "level": "N3"
      }
    ],
    "grammar": [
      {
        "pattern": "〜ようになる",
        "level": "N3",
        "meaning_es": "llegar a hacer / empezar a ser capaz de"
      },
      {
        "pattern": "〜ことになった",
        "level": "N3",
        "meaning_es": "se decidió / resultó que..."
      }
    ]
  }
}
```

---

## 7.1 Target vocabulary

Each target vocabulary item SHOULD contain:

```json
{
  "lemma": "慣れる",
  "reading": "なれる",
  "meaning_es": "acostumbrarse",
  "level": "N3"
}
```

Required:

- `lemma`
- `reading`

Recommended:

- `meaning_es`
- `level`

Optional:

- `dictionary_id`
- `frequency_rank`
- `notes_es`

Target vocabulary should normally consist of words the learner is:

- currently studying;
- expected to encounter again soon;
- transitioning from passive recognition to active recognition.

Do not overload stories with too many target words.

Recommended for a 5–10 minute story:

```text
5–12 target vocabulary items
```

---

## 7.2 Target grammar

Each grammar point SHOULD contain:

```json
{
  "pattern": "〜ようになる",
  "level": "N3",
  "meaning_es": "llegar a hacer / empezar a ser capaz de"
}
```

Recommended per story:

```text
1–4 grammar targets
```

Avoid introducing many unrelated grammar structures in the same story.

---

# 8. Content structure

The story text is stored inside:

```json
{
  "content": {
    "paragraphs": []
  }
}
```

Example:

```json
{
  "content": {
    "paragraphs": [
      {
        "id": "p1",
        "sentences": []
      }
    ]
  }
}
```

---

# 9. Paragraphs

Each paragraph must contain:

- `id`
- `sentences`

Example:

```json
{
  "id": "p1",
  "sentences": [
    {}
  ]
}
```

Recommended IDs:

```text
p1
p2
p3
```

---

# 10. Sentences

Each sentence is the main interactive unit of the reader.

Example:

```json
{
  "id": "s1",
  "text": "新しい仕事に少しずつ慣れてきました。",
  "translation_es": "Poco a poco me he ido acostumbrando al nuevo trabajo.",
  "tokens": [],
  "grammar_points": []
}
```

Required:

- `id`
- `text`
- `tokens`

Recommended:

- `translation_es`

Optional:

- `grammar_points`
- `notes_es`
- `audio`
- `difficulty`

Sentence IDs must be unique inside the story.

Recommended:

```text
s1
s2
s3
```

---

# 11. Sentence translation

`translation_es` should be:

- natural Spanish;
- faithful to meaning;
- not overly literal unless needed;
- written for comprehension, not grammar analysis.

Bad:

```text
En cuanto a mí, después de que terminé el trabajo...
```

Better:

```text
Después de terminar el trabajo...
```

The app may hide translations by default.

---

# 12. Tokenization

Each sentence must contain a `tokens` array.

Example:

```json
{
  "tokens": [
    {
      "surface": "新しい",
      "lemma": "新しい",
      "reading": "あたらしい"
    },
    {
      "surface": "仕事",
      "lemma": "仕事",
      "reading": "しごと"
    },
    {
      "surface": "に",
      "lemma": "に",
      "reading": "に",
      "type": "particle"
    },
    {
      "surface": "慣れて",
      "lemma": "慣れる",
      "reading": "なれて",
      "target": true
    }
  ]
}
```

---

## 12.1 Required token fields

Each meaningful lexical token should contain:

- `surface`
- `lemma`
- `reading`

### `surface`

Exact form appearing in the sentence.

Example:

```text
慣れて
```

### `lemma`

Dictionary form.

Example:

```text
慣れる
```

### `reading`

Reading corresponding to the surface form.

Example:

```text
なれて
```

---

## 12.2 Optional token fields

```json
{
  "surface": "慣れて",
  "lemma": "慣れる",
  "reading": "なれて",
  "target": true,
  "type": "verb",
  "dictionary_id": "optional",
  "start": 7,
  "end": 10
}
```

Supported optional fields:

- `target`
- `type`
- `dictionary_id`
- `start`
- `end`
- `furigana_segments`
- `known_hint`
- `ignore_lookup`

---

# 13. Character offsets

When possible, tokens SHOULD include:

```json
{
  "start": 7,
  "end": 10
}
```

Offsets use Unicode code-point positions inside `text`.

Convention:

- `start` is inclusive
- `end` is exclusive

Example:

```text
text[start:end]
```

must equal:

```text
surface
```

This enables:

- precise tap targets;
- highlighting;
- grammar span rendering;
- audio synchronization;
- future annotation support.

---

# 14. Furigana

The minimum implementation may use:

```text
surface + reading
```

The app may decide how to render furigana.

For more complex words, `furigana_segments` may optionally be used.

Example:

```json
{
  "surface": "取り扱う",
  "lemma": "取り扱う",
  "reading": "とりあつかう",
  "furigana_segments": [
    {
      "text": "取",
      "reading": "と"
    },
    {
      "text": "り",
      "reading": null
    },
    {
      "text": "扱",
      "reading": "あつか"
    },
    {
      "text": "う",
      "reading": null
    }
  ]
}
```

This field is optional in v1.

---

# 15. Function words

Particles and auxiliaries may appear as tokens.

Example:

```json
{
  "surface": "に",
  "lemma": "に",
  "reading": "に",
  "type": "particle"
}
```

However, the app should normally avoid opening dictionary cards for punctuation and non-useful structural tokens.

Use:

```json
{
  "ignore_lookup": true
}
```

when appropriate.

---

# 16. Grammar annotations

Grammar annotations belong at sentence level.

Example:

```json
{
  "grammar_points": [
    {
      "pattern": "〜てくる",
      "start": 9,
      "end": 15,
      "meaning_es": "cambio que se ha ido produciendo hasta el presente",
      "level": "N3",
      "target": false
    }
  ]
}
```

Required:

- `pattern`

Recommended:

- `start`
- `end`
- `meaning_es`
- `level`
- `target`

Grammar spans may overlap token boundaries.

The application should support highlighting a full grammar structure separately from vocabulary.

---

# 17. Grammar annotation rules

Annotate grammar when it is:

- pedagogically useful;
- relevant to N4–N3 progression;
- a target grammar point;
- likely to be misunderstood if treated word-by-word.

Do NOT annotate every elementary structure.

Avoid unnecessary annotations such as:

```text
です
ます
の
は
を
```

unless the story specifically teaches them.

---

# 18. Vocabulary lookup behavior

When the learner taps a token, the application should:

1. read `lemma`;
2. attempt lookup in the local dictionary;
3. display dictionary meanings;
4. display reading;
5. display known/learning status from the user profile;
6. optionally display JLPT/frequency information;
7. allow saving the word.

The story file should NOT contain full dictionary entries.

---

# 19. User learning state

User progress does NOT belong inside story files.

Do not store:

```text
known
learning
mastered
times_seen
last_seen
SRS interval
```

inside YomuStory files.

These belong to the user database.

Example separate state:

```json
{
  "lemma": "慣れる",
  "status": "learning",
  "times_seen": 7,
  "correct_count": 5,
  "incorrect_count": 2
}
```

---

# 20. Comprehension questions

Optional object:

```json
{
  "comprehension": {
    "questions": []
  }
}
```

Example:

```json
{
  "id": "q1",
  "type": "multiple_choice",
  "question_ja": "主人公はどこで働いていますか。",
  "question_es": "¿Dónde trabaja el protagonista?",
  "options": [
    {
      "id": "a",
      "text": "レストラン"
    },
    {
      "id": "b",
      "text": "学校"
    },
    {
      "id": "c",
      "text": "ホテル"
    }
  ],
  "answer": "a",
  "explanation_es": "El texto indica que trabaja en un restaurante."
}
```

---

## 20.1 Supported question types

v1 SHOULD support:

```text
multiple_choice
true_false
short_answer
```

Recommended per story:

```text
3–5 questions
```

Questions should test reading comprehension, not trivia.

---

# 21. Generation metadata

Every generated story must contain a `generation` object.

Example:

```json
{
  "generation": {
    "generator": "codex",
    "model": "unknown",
    "prompt_version": "1.0",
    "profile_version": "1.0",
    "created_at": "2026-10-06",
    "validated": true
  }
}
```

Required:

- `generator`
- `prompt_version`
- `created_at`

Recommended:

- `profile_version`
- `validated`

Optional:

- `model`
- `revision`
- `source_prompt_id`
- `notes`

Use ISO date format:

```text
YYYY-MM-DD
```

---

# 22. Story-generation quality rules

A generated story should follow all of the following.

## 22.1 Natural Japanese

Japanese must sound natural.

Avoid sentences that exist only to force vocabulary into the story.

## 22.2 Coherent story

The story must have:

- a recognizable setting;
- logical progression;
- clear referents;
- natural paragraph structure.

## 22.3 Controlled difficulty

For an N4→N3 learner:

- most sentences should be understandable from context;
- some N3 vocabulary should appear;
- known vocabulary should recur;
- target vocabulary should recur naturally;
- advanced N2/N1 language should be rare unless context makes it easy.

## 22.4 Vocabulary recycling

Target words should usually appear more than once when natural.

Recommended:

```text
important target word: 2–4 appearances
secondary target word: 1–2 appearances
```

Do not create obvious repetitive drills.

## 22.5 Grammar recycling

Target grammar should appear enough to be noticed.

Recommended:

```text
1–3 natural occurrences per target structure
```

## 22.6 Avoid English-style Japanese

Do not translate English or Spanish sentence structure directly into Japanese.

## 22.7 Avoid unnecessary rare kanji

Prefer common Japanese orthography appropriate to the level.

---

# 23. Personal-context generation

Stories may use learner context to increase engagement.

Examples:

- working in Australia;
- restaurants;
- cooking;
- motorcycles;
- living in Japan;
- Osaka;
- travel;
- daily work;
- social life.

Personal context should function as story inspiration, not as a mandatory factual diary.

Generated stories may be fictional.

---

# 24. Content length

Recommended ranges:

## Short

```text
300–500 Japanese characters
3–5 minutes
```

## Standard

```text
500–900 Japanese characters
5–10 minutes
```

## Long

```text
900–1500 Japanese characters
10–15 minutes
```

Default:

```text
Standard
```

---

# 25. Manifest

The cloud library should expose a manifest file.

Recommended:

```text
manifest.json
```

Example:

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-10-06",
  "stories": [
    {
      "id": "work_001",
      "title": "新しい仕事",
      "title_es": "El nuevo trabajo",
      "level": "N4-N3",
      "difficulty": 2,
      "estimated_minutes": 7,
      "topics": [
        "仕事",
        "オーストラリア"
      ],
      "path": "stories/work/work_001.json"
    }
  ]
}
```

The app should:

1. download the manifest;
2. compare it with the local cache;
3. show available stories;
4. download individual story JSON files on demand;
5. cache downloaded stories locally.

---

# 26. Recommended repository structure

```text
yomustory-library/
│
├── manifest.json
│
├── README.md
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
│   └── learner-profile.example.json
│
└── tools/
    ├── validate-stories/
    ├── build-manifest/
    └── generate-story/
```

---

# 27. Recommended generation pipeline

```text
Learner profile
      ↓
Story-generation prompt
      ↓
LLM / Codex
      ↓
Raw Japanese story
      ↓
Structured sentence segmentation
      ↓
Japanese morphological analysis
      ↓
Token / lemma / reading enrichment
      ↓
Grammar annotation
      ↓
YomuStory JSON
      ↓
Schema validation
      ↓
Repository
      ↓
Manifest rebuild
      ↓
Application sync
```

---

# 28. Validation

Every generated story must be validated before publication.

Validation should check:

## Structure

- valid JSON;
- correct `schema_version`;
- unique story ID;
- unique sentence IDs;
- required fields present.

## Japanese text

- every sentence contains text;
- every lexical token has a valid surface;
- token surface appears at the expected offsets;
- readings are valid hiragana/katakana where applicable.

## Targets

- target vocabulary exists in the story;
- target grammar exists in the story;
- no target item is declared but unused.

## Metadata

- difficulty between 1 and 5;
- estimated reading time greater than zero;
- level is valid.

## Translation

- translation count matches sentences where required;
- translations are non-empty.

---

# 29. Generation failure policy

If the generator cannot confidently produce a valid story:

DO NOT invent malformed data.

It should instead return a generation error.

Recommended failure format:

```json
{
  "success": false,
  "errors": [
    "Unable to validate token offsets for sentence s4."
  ]
}
```

Malformed stories should never be added to the library.

---

# 30. JSON Schema

A formal JSON Schema should eventually exist at:

```text
schema/yomustory-v1.schema.json
```

The Markdown specification remains the human-readable source of truth.

The JSON Schema should enforce:

- required keys;
- data types;
- allowed enum values;
- minimum and maximum values;
- basic string patterns.

Semantic checks such as whether a target vocabulary item actually appears in the Japanese text must be implemented separately.

---

# 31. Example complete story

```json
{
  "schema_version": "1.0",
  "id": "work_001",

  "metadata": {
    "title": "新しい仕事",
    "title_es": "El nuevo trabajo",
    "summary_es": "Una historia breve sobre empezar a acostumbrarse a un nuevo trabajo.",
    "level": "N4-N3",
    "difficulty": 2,
    "topics": [
      "仕事",
      "日常生活"
    ],
    "estimated_minutes": 5,
    "sentence_count": 3,
    "paragraph_count": 1
  },

  "targets": {
    "vocabulary": [
      {
        "lemma": "慣れる",
        "reading": "なれる",
        "meaning_es": "acostumbrarse",
        "level": "N3"
      },
      {
        "lemma": "経験",
        "reading": "けいけん",
        "meaning_es": "experiencia",
        "level": "N3"
      }
    ],

    "grammar": [
      {
        "pattern": "〜てくる",
        "level": "N3",
        "meaning_es": "cambio que se desarrolla hasta el presente"
      }
    ]
  },

  "content": {
    "paragraphs": [
      {
        "id": "p1",
        "sentences": [
          {
            "id": "s1",
            "text": "新しい仕事を始めてから、一週間が経ちました。",
            "translation_es": "Ha pasado una semana desde que empecé el nuevo trabajo.",
            "tokens": [
              {
                "surface": "新しい",
                "lemma": "新しい",
                "reading": "あたらしい"
              },
              {
                "surface": "仕事",
                "lemma": "仕事",
                "reading": "しごと"
              },
              {
                "surface": "始めて",
                "lemma": "始める",
                "reading": "はじめて"
              },
              {
                "surface": "一週間",
                "lemma": "一週間",
                "reading": "いっしゅうかん"
              },
              {
                "surface": "経ちました",
                "lemma": "経つ",
                "reading": "たちました"
              }
            ],
            "grammar_points": []
          },

          {
            "id": "s2",
            "text": "最初は大変でしたが、少しずつ仕事に慣れてきました。",
            "translation_es": "Al principio fue duro, pero poco a poco me he ido acostumbrando al trabajo.",
            "tokens": [
              {
                "surface": "最初",
                "lemma": "最初",
                "reading": "さいしょ"
              },
              {
                "surface": "大変",
                "lemma": "大変",
                "reading": "たいへん"
              },
              {
                "surface": "少しずつ",
                "lemma": "少しずつ",
                "reading": "すこしずつ"
              },
              {
                "surface": "仕事",
                "lemma": "仕事",
                "reading": "しごと"
              },
              {
                "surface": "慣れて",
                "lemma": "慣れる",
                "reading": "なれて",
                "target": true
              }
            ],
            "grammar_points": [
              {
                "pattern": "〜てくる",
                "meaning_es": "cambio que ha ido ocurriendo hasta ahora",
                "level": "N3",
                "target": true
              }
            ]
          },

          {
            "id": "s3",
            "text": "毎日新しい経験があるので、これからも頑張りたいです。",
            "translation_es": "Cada día tengo nuevas experiencias, así que quiero seguir esforzándome.",
            "tokens": [
              {
                "surface": "毎日",
                "lemma": "毎日",
                "reading": "まいにち"
              },
              {
                "surface": "新しい",
                "lemma": "新しい",
                "reading": "あたらしい"
              },
              {
                "surface": "経験",
                "lemma": "経験",
                "reading": "けいけん",
                "target": true
              },
              {
                "surface": "頑張りたい",
                "lemma": "頑張る",
                "reading": "がんばりたい"
              }
            ],
            "grammar_points": []
          }
        ]
      }
    ]
  },

  "comprehension": {
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "question_ja": "仕事を始めてからどのくらい経ちましたか。",
        "question_es": "¿Cuánto tiempo ha pasado desde que empezó el trabajo?",
        "options": [
          {
            "id": "a",
            "text": "一日"
          },
          {
            "id": "b",
            "text": "一週間"
          },
          {
            "id": "c",
            "text": "一か月"
          }
        ],
        "answer": "b",
        "explanation_es": "La primera frase dice que ha pasado una semana."
      }
    ]
  },

  "generation": {
    "generator": "codex",
    "prompt_version": "1.0",
    "profile_version": "1.0",
    "created_at": "2026-10-06",
    "validated": true
  }
}
```

---

# 32. Implementation priorities

## V1 — required

Implement:

- story metadata;
- paragraphs;
- sentences;
- Spanish translations;
- tokens;
- lemma;
- reading;
- target vocabulary;
- target grammar;
- manifest;
- local caching;
- dictionary lookup.

## V1.1 — recommended

Add:

- comprehension questions;
- user word status;
- known-word furigana hiding;
- reading history;
- story completion state.

## V2 — future

Potential additions:

- sentence audio;
- word-level audio timing;
- pitch accent;
- kanji stroke-order links;
- adaptive story generation;
- grammar mastery scoring;
- recommendation engine;
- cloud progress sync;
- SRS integration.

---

# 33. Non-goals for YomuStory v1

The story format should NOT attempt to solve:

- full dictionary storage;
- SRS algorithm design;
- user authentication;
- payment infrastructure;
- AI API integration;
- text-to-speech generation;
- full grammar-dictionary design.

These systems should remain separate.

---

# 34. Core architectural rule

A story file answers:

> What is this reading, what does it contain, and what should the learner notice?

The linguistic database answers:

> What does this Japanese word or kanji mean?

The user database answers:

> What does this learner already know?

The reader application answers:

> What should be shown right now?

The generator answers:

> What should the learner read next?

Keeping these responsibilities separate is a fundamental requirement of the project.
