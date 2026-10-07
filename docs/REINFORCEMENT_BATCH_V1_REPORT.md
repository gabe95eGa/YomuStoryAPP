# Reinforcement Story Batch V1 and GitHub CI

## 1. Baseline

Started from `fd409a836bfb72d6c81f0efd7dcac78ce1d88907` on `main`: five stories,
75 backend tests and 87 frontend tests. Baseline validation, manifest check,
typecheck and build passed before edits.

## 2. Generation input

No valid `yomustory-learner-context-*.json` export was found inside the workspace.
The schema itself is excluded from the search. This run therefore used
`profiles/learner-profile.example.json`, explicitly a **profile-only fallback**.
Its two Known and three Learning words are sample configuration, not measured
browser knowledge. No runtime vocabulary was invented or marked Known/Learning.
No browser state, backup, exported context, or profile was changed. No context
snapshot is committed. A future run should place its real exported context in
the workspace; the audit selects the newest valid snapshot by `generated_at`,
not filename, ignoring invalid newer files.

## 3. Level

Spanish native language; Japanese current N4, target N3. Difficulty 2;
N4–N3 labels are editorial estimates. The profile requests eight maximum new
lexical items and two grammar targets. These short pilots use 257–295 body
characters, under the request's shorter-test-batch allowance. They do not meet
the normal 500–900-character standard; extending them with repetitive padding
was avoided. Four-minute estimates allow deliberate reading and vocabulary work.

## 4. Published stories

| ID | Japanese title | Spanish title | Form | Characters | Declared Learning targets and body occurrences |
| --- | --- | --- | --- | ---: | --- |
| daily_002 | 朝の弁当 | La comida para el trabajo | First-person routine after a forgotten lunch | 257 | 準備 4; 慣れる 2 |
| work_002 | 水と皿の準備 | Preparar el agua y los platos | Workplace dialogue and correction | 295 | 準備 3; 確認 4 |
| travel_002 | バイクと地図 | La moto y el mapa | Motorcycle route anecdote | 291 | 慣れる 4; 確認 4 |
| japan_002 | 駅まで歩く生活 | Caminar hasta la estación | Practical Japan-life guidance | 280 | 準備 4; 慣れる 4 |
| cooking_002 | ゆっくり切っておこう | Dejar las verduras cortadas | Learning to prepare vegetables with a friend | 267 | 慣れる 4; 準備 4 |

## 5. Vocabulary reinforcement

All three available Learning lemmas occur in the batch and in multiple stories.
Each story deliberately selects two declared targets, each appearing 2–4 times.
Known `仕事` appears in daily/work/travel/Japan; `食べる` in daily/travel/Japan/cooking.
No per-story coverage of every Learning word was required or implied.

## 6. Grammar

Both configured Learning patterns are declared and annotated in every story:
`〜ておく` has 13 target annotations; `〜ようになる` has six. These are annotated
examples, not all possible grammatical occurrences. Preparation, a resulting
habit, and becoming accustomed fit each scene; grammar is not inferred mastered.

## 7. New vocabulary

Exactly eight distinct new content lemmas per story, including Japanese title
vocabulary; 37 distinct new lemmas across the batch:

| Story | New content lemmas |
| --- | --- |
| daily_002 | かばん、入れる、夜、店、弁当、忘れる、朝、行く |
| work_002 | 先輩、客、忙しい、来る、水、皿、私、置く |
| travel_002 | バイク、地図、少し、戻る、行く、見る、道、違う |
| japan_002 | ある、店、日本、歩く、毎日、生活、道、駅 |
| cooking_002 | ゆっくり、切る、包丁、友達、小さい、教える、料理、野菜 |

`tools/reinforcement_metrics.py` audits distinct normalized lemmas against the
input Known/Learning arrays. Basic unlisted nouns, pronouns, adverbs and lexical
verbs count as new. Particles, punctuation, auxiliaries, grammatical nominals
and deictics are excluded; light `する` and state-change `なる` are treated as
grammar support in these reviewed sentences. Preparatory/aspect/benefactive
verbs after connective て/で are excluded; literal `置く` and `来る` count.
Potential-form aliases 行ける→行く and 戻れる→戻る avoid double-counting inflections.
Native tokenizer lemmas remain intact in published tokens. Quiz prompts and
distractors are outside the reading-body budget and may introduce other words.
This is an explicit editorial budget, not semantic mastery/homograph matching.
The profile's 85% familiar proportion is **not achieved or claimed** with its
tiny sample Known list; the metric does not fabricate a percentage.

## 8. Linguistic and dictionary review

Drafts, tokenizer outputs and revision artifacts were kept in ignored
`.tmp/reinforcement-batch/`. The existing pinned Sudachi pipeline (split C,
SudachiPy 0.6.11/core 20260723) produced complete token spans and readings.
All five were reviewed before publication for text/translation consistency,
target sense, collocations, repetitions, grammar spans and question answers.
Revisions clarified the colleague's water-placement correction, the lunch
question, the vegetable-cutting action, and Japan-life preparation wording.
Each has Spanish translation for every sentence and three comprehension
questions (multiple choice, true/false, short answer) with explanations.

The installed JMdict bundle was read without changes/downloads: 慣れる/なれる
matches real entry 1212670; 準備/じゅんび entry 1341670; 確認/かくにん entry
1205900. No IDs were invented or inserted into story tokens. Readings retain
tokenizer annotations; the existing reader converts displayed ruby to hiragana.
This is model editorial review, not independent native-speaker certification.

## 9. Manifest and preservation

Exactly five new `_002` files; all ten unique IDs validate. The complete manifest
was rebuilt and checked; a second rebuild produced identical bytes. Original
five `_001` JSON files remain byte-identical to the baseline Git revision.
No original IDs, story text, profile, runtime stores or backup schema changed.

## 10–12. Local verification

- Story validation: 10 passed, 0 failed; example profile valid; manifest current.
- Backend: **79 passed**, including pinned tokenizer and four new audit tests.
- Frontend: **92 passed**, including parsing all five new stories and retaining
  existing reader, persistence, backup, dictionary and adaptive-furigana tests.
- Typecheck and production build passed; content sync prepared ten stories.
- CI YAML parsed with a temporary ignored PyYAML installation; main push/PR
  triggers and both jobs checked. No parser dependency added to the project.

The demo test keeps its original length/target constraints for `_001` stories;
the separately tested pilot allowance applies to `_002`. Library/topic-filter
expectations now derive counts from the manifest rather than the original five.

## 13. CI structure

`.github/workflows/ci.yml` runs on pushes to main and PRs targeting main, with
read-only contents permission, per-ref cancellation and 15-minute job limits.
Two independent Ubuntu jobs:

- Python 3.12: pip cache keyed on dependency files; constrained installation of
  development and tokenizer extras; story/profile validation; manifest freshness;
  full pytest including tokenizer integration.
- Reader: `pnpm/setup@v3`, repository-declared pnpm 11.19.0 and Node 24, cached
  dependencies, explicit frozen-lockfile install; typecheck, Vitest, production
  build. No full JMdict download, browser context, backups, or secrets required.

Action setup follows the maintained [pnpm/setup](https://github.com/pnpm/setup),
[checkout](https://github.com/actions/checkout) and
[setup-python](https://github.com/actions/setup-python) documentation.

## 14. Actual GitHub Actions status

Local checks passed. Remote status will be recorded after the implementation
push; a local pass alone is not evidence of a successful GitHub Actions run.

## 15–16. Files

Created: five `stories/{daily,work,travel,japan,cooking}/*_002.json` files,
`.github/workflows/ci.yml`, `tools/reinforcement_metrics.py`,
`tests/test_reinforcement_metrics.py`, this report and
`docs/YOMUSTORY_REINFORCEMENT_CI_V1_PROMPT.md` (preserved request).
Modified: `manifest.json`, `README.md`, `reader/src/App.test.tsx`,
`reader/src/lib/content.test.ts`, `tests/test_validation.py`.
No temporary/private learner files or dictionary assets are committed.

## 17. Limitations

Profile-only personalization, short pilot length, approximate level labels and
editorial lexical counting are explicit limitations. Topic vocabulary remains
new even when elementary. The tiny example Known list cannot support an honest
85% familiar-content claim. Browser learner data was not touched; no new browser
or actual iPad Safari QA was performed for this content-only phase. No generator
UI, AI API calls, automatic mastery, SRS, backend storage or offline installation
was added. The Python tokenizer dictionary is installed in CI; full JMdict is not.

## 18. Next step

Export a real learner context into the workspace, then generate a longer batch
with broader Known vocabulary and independent Japanese review. Read these pilots
on the actual iPad before expanding content volume or adaptive difficulty.
