# Dictionary source and attribution

YomuStory uses JMdict dictionary data, property of James William Breen and the
Electronic Dictionary Research and Development Group (EDRDG), in conformance
with the [EDRDG licence statement](https://www.edrdg.org/edrdg/licence.html).

The source is the full multilingual **JMdict**, converted to JSON by
[scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified).
The exact release, archive URL, date, size and SHA-256 are recorded in
`source.lock.json`. The JSON distribution and our transformed dictionary assets
are distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
This notice concerns dictionary data; it does not relicense the application code.

Original project/documentation:
<https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html>.
JSON distribution documentation:
<https://scriptin.github.io/jmdict-simplified/>.
Full Creative Commons licence:
<https://creativecommons.org/licenses/by-sa/4.0/legalcode>.

Non-English glosses retain their compilers' copyright. EDRDG identifies Spanish
gloss sources as the HISPADIC collaborative project and Francisco Barberan's
RUI dictionary, included with his permission; see the
[source documentation](https://www.edrdg.org/wwwjdic/wwwjdicinf.html#dicfil_tag).
We consume these glosses through the multilingual JSON distribution under its
stated licence, retaining that attribution. We do not claim their copyright or
translate glosses ourselves.

Transformation: retain all entries having English or Spanish glosses; retain
spelling/reading variants and restrictions, sense restrictions, common markers,
part-of-speech, usage/domain/dialect labels and notes; expand coded labels with
the source's tag descriptions; omit other languages, cross-references, antonyms
and etymology; omit blank upstream gloss placeholders; serialize to deterministic gzip JSON chunks and build a browser
lookup index. Spanish and English sense groups are separate upstream; they are
not assumed to be aligned translations. No JLPT levels, numerical frequency
ranking, pitch accent or invented definitions are added.

Attribution and source/licence links are visible on every vocabulary sheet.
The small upstream extracts committed for tests use the same data licence and attribution.
This file is copied alongside generated dictionary assets and included in builds.
For future tablet/Android packaging, retain these notices and provide an accessible
Sources/About screen. Use the preparation command to refresh data regularly;
review and update the pinned release/hash before distributing a new version.
