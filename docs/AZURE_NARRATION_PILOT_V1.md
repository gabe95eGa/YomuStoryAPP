# Azure paragraph narration pilot

## Status

The pilot is published for `cooking_001` (足りない材料 / El ingrediente que faltaba):
370 Japanese characters in four paragraphs, using `ja-JP-NanamiNeural`. Four real
MP3s (442,080 bytes total) were generated with Azure Speech F0 on 18 October 2026.
The Azure management API confirmed an enabled FreeTrial subscription with its
spending limit On; resource creation and synthesis used F0 in Australia East.
No paid tier or billing upgrade was enabled. Every paragraph completed real
browser playback with automatic advancement and no media errors. Durations:
20.952, 19.416, 19.392 and 13.920 seconds (73.680 seconds total).

This is a technical playback check, not expert approval of Japanese pronunciation.
The owner should assess the voice before extending generation to every new story.
The other 29 stories retain local device narration. Existing story text is unchanged.

## Cost boundary

Use only an enabled free-trial subscription with its spending limit **On** and
a dedicated **SpeechServices F0** resource. Never upgrade to S0, remove the
spending limit, or enable pay-as-you-go for this project without a new decision
by the user. A general free allowance is not a guarantee against charges on a
paid subscription. The generator rejects an unprotected subscription or non-F0
resource before retrieving a key and repeats the check for each new request.
Azure CLI is required only on the authoring machine, signed in by the owner.

Azure's free account credit expires after 30 days (or when exhausted); services
are then disabled unless the owner upgrades. This workflow deliberately stops
instead. Downloaded, committed recordings remain usable in the reader.

Official references:
- https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account
- https://azure.microsoft.com/en-us/pricing/details/speech/
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech

## One-story workflow

Run from the repository root, using the project virtual environment on Windows:

```powershell
.venv/Scripts/python.exe tools/story_audio.py prepare cooking_001
# After az login and creating the protected F0 Speech resource:
.venv/Scripts/python.exe tools/story_audio.py generate cooking_001 --resource-id '<Speech ARM resource ID>'
# Play every MP3 under .tmp/audio-drafts/cooking_001 and check pronunciation,
# order, complete paragraphs, clipping, and silence before approving publication.
.venv/Scripts/python.exe tools/story_audio.py publish cooking_001 --playback-checked
.venv/Scripts/python.exe tools/story_audio.py check
pnpm build
```

Only standard Japanese NanamiNeural or KeitaNeural voices are supported. SSML
text is XML-escaped; paragraph recordings are cached to avoid resynthesizing
unchanged drafts. HTTP failures stop immediately, with no retries, paid fallback
or batch synthesis. Partial drafts remain unpublished. Moving a draft aside is
required before changing its text or voice. Speech keys stay in memory, obtained
through Azure CLI, and are never written to files or passed to the reader.
Azure CLI maintains a separate local authentication cache. For this run both
the temporary CLI installation and its login cache are under ignored `.tmp/`
directories; neither is committed. The authoring script itself does not install
Azure CLI or create any resource automatically.

Publication requires an explicit playback check; that is a technical review, not
a claim that a teacher has approved pronunciation. MP3 signature/checksum checks
alone cannot assess pronunciation. Do not publish fixture or synthetic test
bytes as real narration.

## Reader behavior and integrity

- Static same-origin MP3 files, one per paragraph. No Speech API calls on replay.
- Native audio controls, section selection, repeat, previous/next, and optional
  continuation. A rejected play request shows a recoverable error.
- Active paragraph highlighting and persistent pause/resume/stop controls.
- Local voice and recordings stop each other; word lookup/manual navigation
  pause recordings. Page exit/unmount stops playback. Audio never completes a
  reading automatically. No sentence/word timing accuracy is claimed.
- ES/EN controls. Device narration remains available as a fallback.
- The player requires network access to fetch an uncached recording. This does
  not make the whole site available offline.
- Exact paragraph IDs/sentence IDs/Japanese text must match the story. Japanese
  edits invalidate narration; translation/token/furigana changes do not.
- Build and CI verify source fingerprints, file paths, sizes and SHA-256 hashes.
  Only catalog-listed recordings are copied to the published content directory.

## Future stories

After the owner accepts this pilot, add the same prepare → generate → listen →
publish → validate → test/build procedure to every newly generated story. Until
then, do not impose a paid dependency or fabricate recordings to satisfy a
checklist. The original 30 story texts are unchanged.

## Validation for this delivery

- 91 backend tests, 139 frontend tests; all 30 stories and manifest validated.
- Typecheck and production build passed with one catalog-listed narration.
- Source/checksum validation passed. Real playback verified all four sections.
- Mobile player preview: 390px viewport, no horizontal overflow.
- Credentials, Azure login cache, generation drafts and learner context are ignored
  and excluded from the commit. No credentials or API calls are needed in CI.
- CI and deployment results are checked after push; see the delivery message.
