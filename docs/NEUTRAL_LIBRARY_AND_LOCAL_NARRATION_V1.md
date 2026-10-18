# Neutral beta library and local Japanese narration

Implemented 18 October 2026, following feedback on the photographic card design.
This supersedes the active photographic layout described in `READER_POLISH_V2.md`.

## Design decision

Inspected the public [Satori Reader story page](https://www.satorireader.com/stories)
and [Readlang homepage](https://readlang.com/) in the browser, including their
rendered layouts. Satori has distinct, composed artwork for individual series;
Readlang uses a restrained background, clear text hierarchy and a prominent
reading action. Neither is a justification for placing arbitrary large kanji
over repeated generic stock crops. No text or artwork was imported from them.

For this beta, remove the stock images and overlaid kanji from library cards
and the resume card. Use a plain background, readable category label, small
category accent, Japanese title, translated title, level, duration and reading
action. Remove the decorative hero seal and the unused StoryCover component.
Increase topic text slightly. Keep discovery filters and resume behaviour.

The previously downloaded WebP files and their attribution page remain in the
repository, unused by the application, for a possible future considered design.
The library no longer requests those images. No new images were generated.

## Local narration

Reading → Listen in Japanese exposes installed Japanese voices reported as
`localService === true`. Remote Japanese voices, non-Japanese voices and missing
locality information are excluded. Each sentence rechecks the selected voice;
there is no silent fallback to another voice or to a remote/default service.

The feature uses the browser's speech synthesis interface with an explicit
local voice and the original sentence text. There are no external voice API
calls, credentials, new packages, audio uploads or downloaded voice models in
the app. Browser/OS voice installation is a device prerequisite. Some system
voices, including voices available in other OS features, may not be exposed to
the browser. Missing voices and unsupported browsers have actionable messages,
a refresh button when supported and an official Windows installation-help link.

Controls include local voice selection, rates 0.65×/0.8×/1×/1.15×, single-sentence
or continuous playback, pause, resume and stop. Pause cancels the current
utterance; resume starts that sentence again, avoiding inconsistent native
pause/resume behaviour across platforms. Changing voice or speed stops playback.
Controls remain reachable in the bottom navigation while playback is active or
paused. Mobile lookup panels account for that taller navigation.

Spoken sentences become active and update the existing reading position.
Listening does not complete a story or change Known/Learning classifications.
Looking up a word in the current sentence pauses playback; translating that
sentence does not stop it. Manually selecting another sentence stops playback.
Unmounting the reader and pagehide cancel owned speech. Cancelled/stale end and
error events cannot advance a new playback session.

## Meaning of offline

This is local TTS, not speech recognition/dictation or a human-reviewed recording.
Reading/pronunciation quality depends on the installed synthesizer and may
differ from a token's contextual reading. The app explains this distinction.

Once a story and the voice are available on the device, narration can run
without a voice service connection. This does not make the entire website an
offline PWA: a cold page load, a different story or the initial dictionary
installation may still need connectivity. We trust the browser's locality flag;
this iteration does not introduce a bundled cross-device TTS engine.

References:
- [Web Speech specification](https://webaudio.github.io/web-speech-api/#dom-speechsynthesisvoice-localservice)
- [MDN localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
- [MDN voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event)
- [Microsoft supported voices and installation](https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices)

## Validation

- 135 frontend tests across 16 files pass; typecheck and production build pass.
- 81 backend tests pass; all 30 stories validate; manifest check passes.
- New tests cover remote/default exclusion, late voice discovery, explicit
  Japanese voice/rate, sentence sequencing, repeat-on-resume, cancellation,
  stale events, voice disappearance/locality changes, errors, pagehide,
  unsupported environments, single-sentence mode, English UI and reader controls.
- Browser production preview exposes four installed local Japanese voices:
  Microsoft Ayumi, Haruka, Ichiro and Sayaka. Actual single-sentence playback
  reached its end event; continuous playback advanced to the next sentence.
  Pause, repeat-on-resume and stop were checked through the real UI. No auditory
  pronunciation-quality judgement or physical airplane-mode test is claimed.
- Desktop and mobile viewport checks cover library hierarchy, narration controls
  and lookup/navigation spacing. Automated viewport checks are not physical-device
  testing. No changes to operating-system voice settings were needed or made.
- Stories, manifest, Anki exports, backup schema and private learner context are
  unchanged. Local QA uses a separate preview origin. Private data, screenshots
  and the unrelated `desktop.ini` are excluded from the commit.

CI and Pages are checked after push and their result is reported on delivery.
