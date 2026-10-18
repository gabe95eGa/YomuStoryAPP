# Reader polish V2 and Anki export

Implemented 18 October 2026. Builds on `READER_UX_V1.md`.

## Library and photographs

Five category photographs from Unsplash replace the graphic card headers.
Photographer, original photo page and licence are recorded in
`reader/public/images/credits.html`, linked from the library. Each original was
explicitly offered under the Unsplash License when selected. Photos illustrate
categories, rather than claiming to depict a particular story.

Local WebP derivatives total 432,086 bytes (about 422 KiB), reused across the
30 stories. Card photos load lazily, have intrinsic dimensions, decode
asynchronously and fall back to their category background on failure. The
resume card loads its thumbnail eagerly and has a stronger full-width action
on mobile. There are no third-party image requests during normal app use.
Reading text remains on plain paper.

## Reading

The persistent navigation bar can show/hide the current sentence's translation,
using the same state as the sentence's existing action. It works in Spanish and
English and does not change vocabulary classifications or completion status.
Mobile controls have room at 320 and 390 pixels, respect bottom safe areas and
keep the dictionary above the navigation. The reader observes the selected
sentence's size as well as the lookup panel when keeping content in view.
Sentences taller than the available area align at their beginning and remain
scrollable.

Furigana now uses the tokenizer's contextual reading to separate literal kana
from kanji groups: for example, 食べる has た above 食, leaving べる unannotated.
Explicit editorial segments take precedence. A split is used only when literal
kana anchors produce exactly one alignment. Ambiguous, inconsistent or unusually
long inputs retain whole-word ruby; adjacent kanji compounds are not assigned
invented individual readings. This is a conservative rendering improvement,
not a new dictionary resource or corpus rewrite. Adaptive Known/Learning
behaviour and hiragana display remain intact.

## Anki

Vocabulary → Take it to Anki defaults to Learning, with Known/All options.
Preparation previews card count, missing/ambiguous definitions and language
fallbacks before download. It exports UTF-8 tab-separated `.txt` with Front,
Back and Tags columns and Anki file headers for Tab, HTML and the tags column.
The UI explains importing into a two-field Basic note type and reviewing the
mapping. See the [official text import documentation](https://docs.ankiweb.net/importing/text-files.html).

Front contains the spelling and reading. Back contains real preferred-language
JMdict glosses, with language markup and source/licence attribution. A saved
JMdict identity is authoritative; token-only identities must resolve uniquely
with matching spelling and reading. Missing/ambiguous results are labelled for
review instead of taking an unrelated top-ranked entry. Same spelling/reading
records become one note with combined definitions and status tags. HTML and TSV
fields are escaped. Cancel, vocabulary changes, scope changes and language
changes invalidate pending or prepared data.

Export is read-only: it does not import into Anki, synchronize scheduling or
change learner records. Reimport matching and duplicate handling remain Anki
import choices. This iteration does not add generated examples or audio.

## Loading and validation

Reader and vocabulary views load on demand. Story schema validation moves to
its own dynamically loaded module; generation-profile/context validators are
initialized in the vocabulary route. All existing story validation checks are
preserved. Module download failures have a translated reload action.

The initial main JavaScript falls from 602.52 kB / 187.35 kB gzip to
418.76 kB / 137.21 kB gzip (about 30% / 27% smaller). The 143.89 kB schema
runtime is fetched when validation is needed. This measures the built assets,
not a network-speed benchmark. Vite no longer reports a chunk above 500 kB.

## Checks

- 124 frontend tests across 14 files pass; typecheck and production build pass.
- 81 backend tests pass; 30/30 stories validate; deterministic manifest verifies.
- Added coverage for kana-anchor ambiguity, explicit ruby segments, Anki
  homographs/identities, deduplication, HTML escaping, language fallback,
  cancellation, preview invalidation and shared translation controls.
- Worker concurrency is capped at two after an existing interaction test timed
  out under parallel schema/corpus initialization; the full suite passes within
  its original per-test timeouts with that resource cap.
- Production preview checked in the browser at normal size, 390×844 and
  320×740. Photo cards, resume thumbnail, translated sentence, quick dictionary,
  minimum-width navigation and English Anki controls checked. Viewport testing
  does not replace testing a physical phone.
- Actual download checked with the installed full JMdict in the separate
  preview origin: 友達 / ともだち produced one three-field note with Spanish
  glosses, no missing definition, tags and attribution. Parsed downloaded UTF-8
  using Python's CSV reader with Tab separator. The temporary vocabulary record
  was removed after the check. Import into an actual Anki installation has not
  been tested.
- Stories, manifest, editorial translations, private learner context and backups
  are not modified. `desktop.ini` and local QA artifacts are excluded.

CI and GitHub Pages are checked after push and reported in the delivery message.
