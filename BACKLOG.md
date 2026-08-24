# Luna — remaining work

Status as of 2026-08-24. Milestones M0 through M4 are complete and committed:
246 tests, 98% lines, `npm run verify` green.

This file is the running list of what is left. It is not a replacement for
CLAUDE.md, which stays the source of truth for how the product should behave.

The brief now carries nine milestones. M0–M5 are the MVP; M6 (reflection mode),
M7 (scaffolding fade) and M8 (voice grounding) are designed but deliberately
unbuilt, and each one requires validation with real people before any code.

---

## Decisions already taken

| Decision | Reasoning |
|---|---|
| **Stay on Expo SDK 57.** Do not downgrade to 54. | Held. The new Mac removed the Xcode ceiling, and the device build works — a downgrade would have been reverted. |
| Expo Go is not used at all. | It is frozen at SDK 54 while the project is 57. Moot now: a local development build installs straight onto the device. |
| Fonts load through `expo-font` + `@expo-google-fonts`, imported per weight. | The package root requires every weight, which put 36 font files in the bundle instead of 6. |
| Haptics sit behind `IHaptics`. | §2 names haptics platform-sensitive; the Android build must be a new adapter. |
| The capture path is a state machine, not a navigation library. | The flow is linear, and §2 forbids a state library until a milestone needs one. |
| **`proposedEmotionIds` lives on `MoodEntry`, not only in the revision log.** | The log only records corrected entries. M6 has to render *any* entry without revealing the analysis, so the proposal is needed on every one. |
| **npm advisories are held off with `overrides`, not `audit fix --force`.** | The forced fix downgrades Expo 57 to 46. `metro@0.84.5` drops `image-size` (which has no patched release at all), and `xcode` only calls `uuid.v4()`, so uuid 11 is safe. |

---

## 0. Blockers — all cleared on 2026-08-24

| # | Was | How it went away |
|---|---|---|
| 0.1 | The app cannot run on a device. | **Done.** `expo prebuild` → `xcodebuild` → installed and launched on a physical iPhone (iPhone 14 Pro, iOS 26.5.2). Expo Go was never needed; a development build replaces it. |
| 0.2 | `.env` absent from the clone. | **Done.** Owner recreated it. |
| 0.3 | Intel 2018 Mac capped at Xcode 16.4. | **Done.** Now an M1 Pro on macOS 26.5.2 with Xcode 26.6. |

Nothing blocks development on hardware any more. Three environment traps cost
real time getting there, and will bite again on a fresh machine:

- **`pod` is shadowed.** `~/.fundomate/bin/pod` is a `kubectl` wrapper that
  masks CocoaPods at `/opt/homebrew/bin/pod`. Prepend Homebrew to PATH for any
  iOS build, or `pod install` fails with `kubectl: command not found`.
- **`LANG` is empty and `LC_CTYPE=C`**, so Ruby reads paths as ASCII-8BIT and
  CocoaPods dies in `unicode_normalize`. Export `LANG=en_US.UTF-8`.
- **`expo run:ios --device` refuses to build with no certificate in the
  keychain**, checking locally before it ever contacts Apple. `xcodebuild
  -allowProvisioningUpdates ... DEVELOPMENT_TEAM=M3K99W5FFQ` issues the
  certificate and profile itself and gets past it.

The development certificate and its profile expire. When the app suddenly
refuses to launch, that is what happened — rebuild to reissue them.

---

## 1. M3 — unfinished tail

| # | Item | Depends on |
|---|---|---|
| 1.1 | `WhisperTranscriptionService` — the only M3 adapter still missing. | 0.1 / 0.3 (whisper.rn is a custom native module and needs a development build) |
| 1.2 | **The §10 experiment — desktop half done on 2026-08-24.** See §1b. Word error rate measured on 16 real recordings. Processing time, battery and model download on a phone are still unmeasured. | Device work for the remaining half. |
| 1.3 | Act on the §10 result: large-v3-turbo is required, and it ships at 1.5 GB. Decide how the model reaches the phone, and what the onboarding privacy copy promises. | 1.2 |
| 1.4 | Remove `ManualTranscriptionService` from the production path once Whisper lands; keep it as the text fallback. | 1.1 |
| 1.5 | **The recorder writes a format Whisper cannot read.** Settle this before 1.1, not during it. | — (decide now, implement with 1.1) |
| 1.6 | **Feed Whisper the user's own language instead of letting it guess on short audio.** Measured, not theoretical — see §1b. Needs a real language setting, which is debt 4.3. | 1.1, and 4.3 for the setting |

**On 1.5, the audio format.** `App.tsx` creates the recorder with
`RecordingPresets.HIGH_QUALITY`, which on iOS is m4a/AAC at 44.1 kHz. whisper.cpp,
which whisper.rn wraps, wants 16 kHz mono WAV — exactly what
`scripts/whisper-experiment.mjs` produces with an `ffmpeg` call before every run.
There is no ffmpeg on the phone to do that conversion, so the app has to arrive
at 16 kHz mono by itself: either record straight into it with a custom preset,
or transcode inside the transcription adapter.

Recording at 16 kHz mono is the better default anyway — it is what the model
consumes, and it makes the file several times smaller. Check first that metering
and silence auto-stop still behave at that sample rate, since `ExpoAudioRecorder`
depends on both.

`IAudioRecorder` is unaffected either way: `AudioRecording` stays
`{ uri, durationMs }`, the ports do not move, and the change is local to the
infrastructure layer.

---

## 1b. §10 first result — 2026-08-24

16 recordings by one speaker in one room: 9 Ukrainian, 3 Russian, 4 mixed.
Raw output in `~/luna-whisper/run-2026-08-24-real-v2.txt`.

**Utterance length decides the outcome, not language.**

| Length | Takes | large-v3-turbo | small |
|---|---|---|---|
| under 4 s | 2 | 1.000 | 0.500 |
| 4–8 s | 7 | 0.231 | 0.468 |
| over 8 s | 7 | 0.120 | 0.395 |

Grouped by language the differences are mostly noise from which takes happened
to be longer. For Ukrainian on the large model the mean is 0.330 but the median
is 0.143 — a handful of very short takes drag the average, and a third of all
takes came back near perfect (0.00, 0.06, 0.08).

What follows from it:

- **`small` is not a candidate.** Two to four times worse in every bucket. On
  one take it scored 1.143 — worse than returning nothing at all.
- **`large-v3-turbo` is usable on normal entries and broken on very short
  ones.** That matters more than it sounds: §5's second regression case is
  "Cooked dinner", and at 2.4 s it came back as "Прогутового вечера". The
  shortest entries are both the most common and the least survivable.
- **Language auto-detection misfires when there is too little audio.** "Норм."
  was transcribed "Normal." — detected as English. Pinning `-l uk` fixes that
  particular class of error but not the acoustic ones: "Приготував вечерю"
  stays wrong either way. Worth testing as a cheap lever before anything else.
- **Whisper rewrites mixed speech.** On a synthetic take it turned "ничего
  особенного" into "нічого особинного". §1 says rewriting the mix rewrites the
  person, and commit 8b3aea7 forbids Claude from doing exactly this — but it
  happens one step earlier, where the prompt cannot reach.

### Pinning the language: measured, 2026-08-24

`scripts/whisper-experiment.mjs` now takes `--language`. Auto stays the
default, because that is the position the app is in. Pinning is for measuring
what the guessing costs. Run in `~/luna-whisper/run-2026-08-24-real-v3-pinned-uk.txt`.

`-l uk` changed exactly two takes out of sixteen:

| Take | Length | Reference language | auto | -l uk |
|---|---|---|---|---|
| take-03 "Норм." | 1.5 s | uk | 1.000 | 0.000 |
| take-07 | 4.4 s | ru | 0.167 | 0.500 |

The other fourteen came back byte-identical. Auto-detection was already right
almost everywhere; it fails only when there is too little audio to decide on,
and then it fails completely — "Норм." was read as English and returned
"Normal.". The group averages move (uk 0.330 to 0.219, ru 0.282 to 0.394) but
each of those swings is one take, so the behaviour is the finding, not the
number.

Note what pinning did **not** fix. take-02, "Приготував вечерю" at 2.4 s,
stayed at 1.000 either way. Short takes break for two independent reasons —
the wrong language is picked, and the words are simply misheard. Pinning
addresses the first only, which moves the under-4-second bucket from 1.000 to
0.500 and no further.

**So do not pin globally** — that is what cost take-07. The app will know the
user's language from settings, which turns a guess into a fact: trust
auto-detection when there is enough audio to detect from, and fall back to the
user's own language when there is not. That is 1.6, and it needs the language
setting that 4.3 describes, which puts M5 and transcription closer together
than they looked.

**How much to trust this.** One speaker, one room, 16 takes, and only 2 in the
under-4-second bucket that produced the worst number. Takes 01–11 were read
from a script, 12–16 were spontaneous; the spontaneous ones scored best, but
they were also the longest, so the two effects are confounded. A first run
against `~/luna-whisper/run-2026-08-24-real-v1.txt` scored worse purely because
the references came from the script rather than from what was actually said —
about a sixth of the measured error was that mistake, not the model's.

**Still unmeasured, and device-only:** processing time on a phone, battery
cost, and how a 1.5 GB model gets onto the device in the first place.

---

**§10 can be split, and the cheap half is unblocked.** Word error rate is a
property of the model, not the hardware, and whisper.rn wraps the same
whisper.cpp that runs on a desktop, so quality can be measured on this Mac now.
Processing time and battery are device properties and must wait. Mobile builds
sometimes use quantised weights, so a desktop number is a strong signal rather
than a final one.

**§10 was overdue against its own gate** — the brief says "verify before M4",
and M4 was built first. The desktop half is now done (§1b) and the answer is
the brief's middle outcome: good enough only on the large model, so app size
against accuracy is now an explicit decision rather than an assumption. The
onboarding privacy copy and the free-tier limits depend on how that lands, so
settle 1.3 before writing M5.

---

## 1a. The reflection pipeline has been tested end to end

`scripts/analyze-transcripts.mjs` runs written transcripts through the real
analyzer, vocabulary and use case — no device, no microphone. It has been run
against the live API and it earned its keep: it exposed two prompt bugs, fixed
in `8b3aea7`.

- Luna answered Ukrainian sentences with English observations. The prompt set
  the language of the cleaned transcript and said nothing about the
  observation, which is the only text Luna actually says out loud.
- Mixed Ukrainian and Russian speech was normalised into one language. §1 says
  the audience mixes both inside a sentence, so rewriting the mix rewrites the
  person.

Re-run it whenever the prompt changes. It needs 0.2.

---

## 2. M4 — built, not verified

| # | Item | Who |
|---|---|---|
| 2.1 | **Measure capture-to-save under ten seconds.** M4's completion criterion, still unverified — but no longer blocked: the app runs on the phone. | Owner, on hardware |
| 2.2 | Check the dark theme on a real screen. §7.10 warns the green confirmation and the teal accent sit close in tone. | Owner |
| 2.3 | **Decide what a crisis entry shows.** The domain nulls `observation` correctly, but §6 says what appears instead is a product decision. The card currently shows nothing. | Owner |

---

## 3. M5 — not started

- Insights screen: free daily trend, paywalled weekly narrative
- Onboarding, with the privacy screen **before** the microphone request
- Settings, with a reminder time picker
- Local notifications
- Paywall and the free/paid boundary
- **Done when:** the boundary matches §6 and nothing in the capture path got slower

`GetWeekSummary` and `ClaudeNarrativeGenerator` already exist from M2 and M3.
What is missing is the screen and the entitlement check.

The onboarding privacy copy depends on 1.3. Writing it before the §10 result is
known risks writing a promise the STT cannot keep.

---

## 4. Deliberate debt

| # | Debt | Why it matters |
|---|---|---|
| 4.1 | **The Claude api key ships inside the bundle.** `EXPO_PUBLIC_*` is inlined and can be extracted from the app. | Release blocker. The fix is a thin proxy; only the adapter's base URL changes. |
| 4.2 | Metro resolves `node:*` to an empty module so the Anthropic SDK can bundle. A Node built-in reaching a live code path would become a confusing runtime error instead of a build error. | Goes away with 4.1. |
| 4.3 | Locale is pinned to `uk`. Detecting it needs `expo-localization`; the iOS-only native alternative is the kind of fork §2 forbids. | M5, alongside settings. |
| 4.4 | Safe area is a fixed 64pt top pad rather than a measured inset. | Visible on notched devices. |
| 4.5 | Streak plurals are simplified (`{{count}} дн.`); Ukrainian plural rules are not implemented. | Cosmetic. |
| 4.6 | Icons are hand-drawn from `View`s. §7.4 wants a real set that scales with Dynamic Type. | Sizing is already token-driven, so the swap is local. |
| 4.7 | `warm` and `tension` resolve to the same value in the dark palette (inherited from §7.10). | The rule holds — honey marks achievements only — but they should be separated if a conflict shows. |
| 4.8 | **No component tests.** Jest runs in plain Node; React components would need `jest-expo` and a testing library. `useCaptureFlow.ts` is 179 lines of untested state machine. | The largest coverage gap. |
| 4.9 | No navigation library. Fine for a linear capture path; M5 adds insights and settings. | Re-evaluate at the start of M5. |
| 4.10 | `ConfirmEntry` logs `proposed.emotionIds`, which is now the same value as `confirmed.proposedEmotionIds`. | Harmless duplication; a candidate for simplification when M6 lands. |
| 4.11 | `fromStored` reads `proposedEmotionIds` leniently and falls back to `emotionIds`. Exact for an entry nobody corrected; a guess for a corrected one, where the revision log holds the truth. | Only affects records written before the field existed. Can be dropped once no such records can exist. |

---

## 5. Design questions to settle on hardware (§7.10)

- Honey and tension are close in tone and collapse to one token in the dark theme
- Green confirmation against the teal accent — verify they read as different
- The insights screen scrolls on small phones once type scales up; the narrative
  should fit above the fold on an SE-sized device

---

## 6. Explicitly out of scope (§9)

Pattern detection, voice-topic analysis, health data, personalisation,
appending to an entry, analytics and crash SDKs before M5, breathing exercises
or a library of techniques, a text input anywhere in the grounding exercise,
and any extra step, confirmation or optional field in the capture path.

M6 and M7 must not be built before M5 ships.
