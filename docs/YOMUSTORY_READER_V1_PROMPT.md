# YomuStory Reader V1 — Implementation Prompt

You are continuing development of an existing project called **YomuStoryAPP**.

The project already has a stable V1 content backend.

Current known state:

- Private GitHub repository: `YomuStoryAPP`
- Initial stable commit: `ee00728`
- Working tree was clean after that commit
- 5 valid sample stories
- valid learner profile
- deterministic `manifest.json`
- 69 tests passing
- schemas, validators, manifest builder, optional tokenizer, generation prompt, learner profile, and documentation already exist
- story data, dictionary data, and learner state are intentionally separated

Do NOT rebuild or redesign the existing story backend unless a real compatibility issue requires it.

Your task is to implement the first usable **YomuStory Reader** on top of the existing system.

---

# 1. First action

Before changing anything:

1. Inspect the entire repository.
2. Read:
   - `README.md`
   - `YOMUSTORY_SPEC.md`
   - `manifest.json`
   - at least 2 existing story JSON files
   - learner profile schema/example
   - existing tests
3. Run the current verification commands.
4. Confirm the current project is healthy before making changes.

Use the project’s existing environment and conventions.

Do not assume that the repository structure is exactly as described here. Inspect it first.

---

# 2. Main objective

Build a minimal but genuinely usable Japanese reading application.

The goal of Reader V1 is to prove that the YomuStory format works correctly in a real reading experience.

The application should allow the learner to:

1. browse available stories;
2. open a story;
3. read the Japanese text comfortably;
4. show or hide furigana;
5. tap/click vocabulary tokens;
6. inspect basic token information;
7. reveal sentence translations;
8. navigate through the story;
9. mark a story as completed;
10. preserve simple reader progress locally.

This is a vertical slice.

Do NOT attempt to build the full final product yet.

---

# 3. Product direction

The reading experience may take inspiration from graded-reading applications such as Yomu Yomu, Satori Reader, LingQ, or similar language-learning readers.

However:

- do not copy proprietary UI;
- do not copy branding;
- do not copy assets;
- do not copy source code;
- do not reproduce another product pixel-for-pixel.

Create an original, clean YomuStory interface.

The reader should feel focused, calm, lightweight, and designed primarily for Japanese reading.

---

# 4. Platform choice

First inspect the repository.

If no UI framework already exists, choose a sensible stack for a personal project that can later work well on desktop, tablet, and mobile.

Preferred approach:

- React
- TypeScript
- Vite

unless there is a strong reason in the existing repository to choose differently.

Do NOT introduce a large or complicated application framework unless necessary.

For Reader V1:

- local/static content is acceptable;
- authentication is unnecessary;
- no backend server is required;
- no paid services;
- no AI API;
- no database server.

The reader must be able to run locally.

---

# 5. Preserve the existing architecture

The existing separation is intentional:

```text
Story data
Dictionary data
Learner state
Reader UI
Generator
```

Maintain that separation.

The reader should consume existing YomuStory files.

Do NOT move user progress into the story JSON files.

Do NOT embed dictionary definitions directly into stories.

Do NOT modify generated story files just because the UI needs additional state.

---

# 6. Reader V1 screens

Implement at least these two primary screens:

## 6.1 Library

Display available stories from `manifest.json`.

Each story card should show:

- Japanese title;
- Spanish title;
- JLPT level;
- difficulty;
- estimated reading time;
- topic/tags where useful;
- completion status.

Cards should be easy to scan.

Allow opening a story.

Basic filtering by level or topic is optional if straightforward.

Do not overbuild filtering in V1.

---

## 6.2 Reader

Opening a story should present:

- Japanese title;
- story metadata;
- Japanese paragraphs;
- readable typography;
- furigana support;
- sentence translation controls;
- interactive vocabulary;
- reading progress;
- completion action.

The main Japanese text must visually dominate the page.

Avoid clutter.

---

# 7. Japanese typography

Japanese text is the core of the app.

Use appropriate typography and spacing.

Requirements:

- large enough font for comfortable reading;
- sensible line-height;
- proper Japanese wrapping;
- ruby/furigana positioning should not collide with nearby lines;
- punctuation should render naturally;
- layout should work well at tablet width.

Prefer system Japanese fonts instead of introducing a large custom font dependency unless necessary.

---

# 8. Furigana

Implement a global reader toggle:

```text
Furigana ON / OFF
```

Use the existing token data:

```json
{
  "surface": "仕事",
  "lemma": "仕事",
  "reading": "しごと"
}
```

Render furigana using proper HTML semantics where possible:

```html
<ruby>
  仕事
  <rt>しごと</rt>
</ruby>
```

Important:

Do NOT display redundant furigana over pure kana tokens.

For example:

```text
これ
から
です
```

should not receive unnecessary ruby annotation.

For mixed kanji/kana tokens, prefer the simplest correct V1 behavior based on the information available in the story format.

Do not build a complex furigana alignment engine unless genuinely necessary.

---

# 9. Interactive vocabulary

Tokens should be interactive where useful.

When the user clicks/taps a meaningful token, open a lightweight vocabulary panel.

For Reader V1, display information already available from story data:

- surface form;
- dictionary/lemma form;
- reading;
- target vocabulary status if present;
- optional type if present.

Example:

```text
慣れて

慣れる
なれる

Target vocabulary
```

Do NOT pretend this is a complete dictionary definition yet.

If no dictionary integration exists, clearly structure the component so JMdict can be added later.

The vocabulary panel may be:

- bottom sheet;
- popover;
- side panel;
- modal.

Choose the interaction that works best responsively.

On mobile/tablet, a bottom sheet is preferable.

---

# 10. Token interaction rules

Not every token needs to behave like a dictionary word.

Ignore or de-emphasize:

- punctuation;
- tokens marked `ignore_lookup`;
- trivial structural elements when appropriate.

Target vocabulary should have a subtle visual distinction, but do not make reading visually noisy.

Do not permanently highlight every learning token with strong colors.

---

# 11. Sentence translations

Translations should be hidden by default.

Provide a simple way to reveal the Spanish translation for an individual sentence.

Possible interaction:

```text
Japanese sentence

[Show translation]
```

After revealing:

```text
Japanese sentence

Poco a poco me he ido acostumbrando al trabajo.
```

Do not show every translation permanently by default.

The philosophy is:

```text
Try to understand Japanese first.
Reveal help only when needed.
```

---

# 12. Sentence interaction

Each sentence is a meaningful reader unit.

Structure the implementation so future features can attach to a sentence:

- translation;
- grammar explanations;
- audio;
- highlighting;
- comprehension state.

Do not flatten the story into a single raw HTML string.

Render from structured paragraphs → sentences → tokens.

---

# 13. Grammar data

If a sentence contains `grammar_points`, support them architecturally.

Reader V1 does NOT need a complete grammar explanation interface.

At minimum:

- preserve grammar information;
- do not discard it;
- optionally expose a small grammar indicator.

If easy to implement cleanly, allow clicking a grammar indicator to show:

- pattern;
- Spanish meaning;
- JLPT level;
- whether it is a target.

Do not allow grammar UI complexity to delay the core reader.

---

# 14. Reading progress

Implement simple local progress.

No account or cloud sync yet.

Use browser-local persistence, such as:

```text
localStorage
```

Store separately from story files.

At minimum support:

```text
story_id
last_opened
completed
```

Optionally:

```text
last_sentence
progress_percentage
```

Keep the storage layer abstract enough that it could later be replaced by cloud sync.

---

# 15. Completion

At the end of a story provide:

```text
Complete reading
```

or equivalent.

Completion should:

- mark the story as completed locally;
- update the Library UI;
- persist across reloads.

Provide a way to reopen completed stories.

Do not hide them.

---

# 16. Reader controls

Create a minimal reader toolbar.

Recommended controls:

- back to library;
- furigana toggle;
- reading progress;
- optional text size control.

Do not add dozens of settings.

The reading surface should remain uncluttered.

---

# 17. Responsive design

Reader V1 should work properly on:

- desktop;
- tablet;
- narrow/mobile viewport.

The project is likely to be used heavily on an iPad later, so tablet usability matters.

Test at representative widths.

Avoid UI that only works with mouse hover.

Any important interaction must work with touch.

---

# 18. State management

Keep state management simple.

Do not introduce Redux or another large global state framework unless genuinely necessary.

React state/context or a similarly lightweight approach should be enough for V1.

Separate:

- content loading;
- reader UI state;
- local learner/progress state.

---

# 19. Content loading

The reader must consume the existing generated content.

Preferred flow:

```text
manifest.json
    ↓
Library
    ↓
story path
    ↓
story JSON
    ↓
Reader
```

Do not manually duplicate story metadata inside the frontend source.

The manifest must remain the library source.

If the development build system requires copying or exposing story JSON to the frontend, do this deterministically and document it.

Avoid generating another competing content format.

---

# 20. Error handling

Handle at least:

- manifest unavailable;
- malformed story;
- story path missing;
- empty library;
- local progress unavailable/corrupted.

Errors should be understandable.

The application should not crash to a blank screen.

---

# 21. Accessibility

Implement basic accessibility:

- buttons use semantic controls;
- keyboard navigation should work;
- focus indicators remain visible;
- clickable words should be accessible;
- modals/sheets should be closable;
- text contrast should remain readable.

Japanese token interaction should not require precise tiny click targets.

---

# 22. Visual design

Create an original minimal design.

Direction:

- light, clean interface;
- generous spacing;
- Japanese text as visual focus;
- restrained color usage;
- subtle hierarchy;
- clear interactive states.

Avoid:

- excessive gradients;
- glassmorphism everywhere;
- dashboard appearance;
- oversized decorative elements;
- visually dense cards.

This is a reading tool, not an analytics dashboard.

A dark mode is NOT required for V1 unless trivial to support.

---

# 23. Components

Design reusable components.

Likely examples:

```text
AppShell
StoryLibrary
StoryCard
ReaderPage
ReaderToolbar
StoryParagraph
StorySentence
JapaneseToken
FuriganaText
TranslationReveal
VocabularySheet
GrammarInfo
ReadingProgress
```

These names are suggestions, not requirements.

Do not create abstractions that add complexity without value.

---

# 24. Tests

Preserve all existing backend tests.

Add appropriate frontend tests for critical behavior.

At minimum test:

- manifest loading;
- library rendering;
- opening a story;
- sentence rendering;
- furigana toggle;
- translation reveal;
- vocabulary interaction;
- completion persistence.

Do not chase 100% test coverage.

Focus on meaningful behavior.

All existing tests plus new tests must pass.

---

# 25. Do not modify the YomuStory schema casually

If the frontend exposes a limitation in the current schema:

1. first determine whether it can be solved cleanly in the UI;
2. only change the schema if necessary;
3. maintain backward compatibility where practical;
4. update documentation;
5. update validation;
6. update tests;
7. update sample stories only when required.

Do not redesign the schema for frontend convenience.

---

# 26. Dictionary integration boundary

Prepare an interface/service abstraction such as:

```text
DictionaryService
```

or equivalent.

Conceptually it should later support:

```text
lookup(lemma)
```

Reader V1 may return only the information already available in the story token.

Do NOT implement a fake dictionary dataset merely to make the popup look complete.

We will integrate JMdict in a later phase.

---

# 27. Future features to prepare for, but NOT implement now

Architect cleanly enough to later support:

- JMdict lookup;
- known/learning vocabulary state;
- adaptive furigana;
- grammar explanations;
- audio;
- sentence playback;
- pitch accent;
- SRS;
- comprehension results;
- cloud sync;
- learner profile editing;
- AI-generated story requests;
- recommendations.

Do not implement these unless required for the V1 architecture.

---

# 28. Development workflow

Work incrementally.

Recommended implementation sequence:

```text
1. inspect repository
2. run existing tests
3. bootstrap UI
4. load manifest
5. build library
6. load story
7. render structured Japanese
8. implement furigana
9. implement translations
10. implement vocabulary sheet
11. local progress
12. responsive polish
13. tests
14. documentation
15. final verification
```

Do not replace working existing systems unnecessarily.

---

# 29. Validation before completion

Before declaring Reader V1 complete:

Run the existing backend commands:

```powershell
.\.venv\Scripts\python.exe tools/validate_stories.py
.\.venv\Scripts\python.exe tools/build_manifest.py
.\.venv\Scripts\python.exe -m pytest
```

Also run the frontend:

- type checking;
- tests;
- production build.

Use the actual commands appropriate to the stack you implement.

Everything must pass.

---

# 30. Documentation

Update `README.md` with a section for Reader V1.

Document:

- frontend stack;
- how to install dependencies;
- how to start development mode;
- how to build production;
- how content is loaded;
- where local reading progress is stored;
- current limitations;
- planned JMdict integration.

Do not remove existing backend documentation.

---

# 31. Git discipline

Do not overwrite or rewrite existing history.

Keep changes logically organized.

Before finishing:

- ensure generated junk is excluded;
- ensure `.gitignore` is correct;
- ensure no secrets are committed;
- ensure working tree is understandable.

If committing is part of the current Codex workflow, use a clear commit message such as:

```text
feat: add YomuStory Reader V1
```

Do not force-push.

---

# 32. Definition of done

Reader V1 is complete when:

- existing backend remains functional;
- existing backend tests still pass;
- app loads `manifest.json`;
- library displays existing stories;
- user can open a story;
- Japanese text renders correctly;
- furigana can be toggled;
- token interaction works;
- Spanish sentence translations can be revealed;
- reading completion persists locally;
- layout works on desktop and tablet/mobile;
- basic frontend tests pass;
- production build succeeds;
- README documents the reader;
- no paid API or external backend is required.

---

# 33. Final report

At the end, provide a concise implementation report containing:

1. frontend stack chosen;
2. files/components created;
3. any existing files changed;
4. architectural decisions;
5. how to run the reader;
6. test results;
7. build result;
8. remaining limitations;
9. recommended next step.

Do not merely propose the implementation.

Implement Reader V1 fully in the repository.