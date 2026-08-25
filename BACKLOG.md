# Luna — remaining work

Status as of 2026-08-25. Milestones M0 through M4 are complete and committed:
274 tests, `npm run verify` green.

**M3 is finished.** The voice path runs end to end on a physical iPhone —
record, transcribe on the device, analyse, reflection card.

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
| **The speech model is `large-v3-turbo-q5_0` and arrives during onboarding.** | `small` is unusable on Ukrainian and full turbo is 1.5 GB. Quantising to 547 MB cost nothing measurable. Too large to bundle, so it downloads — and onboarding is the one moment where waiting is expected rather than resented. |
| **Transcription confidence is derived from take duration.** | whisper.rn reports none, and a constant would be a lie the domain acts on: §6 ties emotion depth to confidence. Duration is the only predictor the §10 run supported. |
| **The wait is measured from stop to card, not from tap to save.** Talking is not friction; waiting is. | The old criterion counted the speaking as a cost to reduce, which is backwards for a journal. See §2a. |
| **The observation is written by Sonnet; the rest of the entry stays on Haiku.** Sent in parallel, so the wait is the slower call and not the sum. | This departs from §2, which put the whole entry on Haiku. Measured on 2026-08-25: Haiku produced a sentence that did not parse, clinical labels §7.9 forbids, and feelings nobody had named. The observation is the only field read as prose — everything else is an id, a number, or the speaker's own words — so the risk sits in one sentence, and §7.9 calls it a design surface. |

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

## 1. M3 — done, with one piece waiting on M5

| # | Item | State |
|---|---|---|
| 1.1 | `WhisperTranscriptionService`. | **Done.** Runs on the device. Opened on the first take, not at startup, and held between takes. Falls back to the typed service when no model is on disk, so the app works without one. |
| 1.2 | The §10 experiment. | **Desktop half done**, see §1b. Processing time on a phone, battery, and the real download are still unmeasured. |
| 1.3 | Which model ships and how it arrives. | **Decided and half built.** `large-v3-turbo-q5_0`, 547 MB, downloaded during onboarding. `SpeechModelStore` does the fetching; the onboarding screen that calls it is M5. |
| 1.4 | Remove `ManualTranscriptionService` from the production path. | **Not doing it.** It earned a permanent place: the text fallback §2 asks for, and what the app runs on before the model lands. |
| 1.5 | Record in a format Whisper can read. | **Done.** 16 kHz mono, linear PCM on iOS. |
| 1.6 | Give the recogniser the user's language instead of letting it guess. | **Moot.** Built for Whisper, then Parakeet replaced it and takes no language hint. The code still chooses and nothing reads it — remove, or keep only if Whisper ever returns. |
| 1.7 | **Recalibrate confidence against Parakeet.** The duration bands come from Whisper's error curve and §6 ties emotion depth to them, so a wrong curve makes Luna vaguer than it needs to be. | §1c |
| 1.8 | **Re-measure whether the transcript repair still earns its risk.** It bought 0.034 against nonsense; against clean transcripts it may only be a licence to change someone's words. | §1c |

**Transcription confidence is derived, not reported.** whisper.rn returns none,
and a constant would be a lie the domain acts on, since §6 ties emotion depth
to it. It comes from take duration, the one predictor §1b supported, and the
bands land on `Confidence`'s own thresholds — so a short mumble lifts emotions
to level 1 and flags the entry for review, which is §5's third regression case
finally doing something.

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

## 1c. Recognition quality is the real problem — 2026-08-25

Used on the phone, the transcripts are visibly wrong. "Схвильований" came back
as "Осквильований", "нічого не встиг" as "нічойний стих". This is §1b's
measured 0.33 word error rate showing up as an experience rather than a table.

**Everything cheap was tried and nothing moved it.** The full 1.5 GB model
makes the same mistakes as the 547 MB quantised one. An initial prompt changes
nothing. Beam search rescued one take in four. Whisper is weak at Ukrainian and
no setting fixes that.

**Claude repairing the transcript helps a little and safely.** 0.368 to 0.334,
no take made worse, and the mixing of Ukrainian and Russian survives — the rule
had to be narrowed to "only replace a run of letters that is not a word in
either language" before that was true, because the first version happily turned
Russian words into Ukrainian ones.

**One risk it introduced.** Where a mishearing is not recoverable, the entry
still reads as fluent nonsense, and Luna answers it: "нічойний стих" produced
an observation about insomnia. One in twelve. For a product where a single
invented feeling costs trust in every later one, that is not a rounding error.

**WER is the wrong metric here and should not be trusted alone.** It weighs
every word the same, and this product does not: "закінчує" for "закінчив"
costs nothing, while "халюваний" for "схвильований" destroys the entry. Read
the transcripts as well as the number.

### Parakeet, measured the same day

`whisper.rn` also runs NVIDIA Parakeet TDT 0.6B v3 — same library, same API
shape, GGUF weights from `ggml-org/parakeet-GGUF` at 356 MB (q4_0) to 638 MB
(q8_0). Our adapter sits behind `OpenWhisperEngine`, so swapping the engine
does not reach the domain.

| | whisper turbo q5_0 | parakeet q8_0 |
|---|---|---|
| mean WER | 0.368 | 0.346 |
| median WER | 0.352 | 0.277 |
| Ukrainian mean | 0.364 | 0.390 |
| desktop seconds per take | ~2.4 | **0.52** |
| size | 547 MB | 638 MB (356 MB at q4_0) |

**On the numbers it is a wash. On reading it is not.** Four of five transcripts
inspected by hand came back exactly right under Parakeet where Whisper mangled
them, including the "нічойний стих" take that made Luna invent insomnia, and a
Russian take Whisper got wrong. The losses look like reference drift rather
than errors — Parakeet transcribed a "Так," at the start of one entry that the
written reference had left out, and WER charged it for that.

**And it is 4.6 times faster.** If that ratio holds on the phone, transcription
drops from 7.9 s to under two, which with the card no longer waiting for the
observation puts stop-to-card inside M4's two to three seconds.

### Parakeet on the phone — chosen, same day

```
whisper  (21.0 s of audio)   7872 ms
parakeet (28.7 s of audio)   2121 ms
```

3.7x faster on a longer recording, and the owner — a native speaker — reports
the transcripts came back clean, with the mangling gone. Both axes, so the
question is closed: **Parakeet TDT 0.6B v3 q8_0 is what the app transcribes
with.** Whisper stays in the file as a comparison, one constant away.

Stop to card went from 10.4 s to 4.0 s (2121 transcribe + 1849 Haiku; Sonnet's
4010 no longer blocks). M4 asks for two to three, so the remainder is split
almost evenly between transcription and classification.

Cloud recognition is off the table for now. §9 forbade it, §10 would have
allowed revisiting at the price of the privacy promise, and on-device accuracy
turned out to be good enough that the price never had to be paid.

**Three things this invalidates**, all cheap and none done:

- **Confidence is calibrated on the wrong model.** The duration bands in
  `OnDeviceTranscriptionService` come from Whisper's error rate by take length
  — 1.000 under four seconds, 0.120 above eight. Parakeet's curve is unmeasured
  and probably flatter, so short takes may be marked low-confidence for no
  reason, lifting emotions to level 1 when the transcript was fine.
- **The language hint (1.6) is inert.** Parakeet is multilingual without one.
  The code still chooses; nothing reads the choice.
- **The transcript repair earns less now.** It was worth 0.034 against a
  recogniser that produced nonsense. Against clean transcripts it is mostly a
  licence to alter someone's words, and the invention risk in §1c stays. Worth
  measuring again before keeping.

**Still untried:** q4_0 at 356 MB, which would nearly halve what onboarding has
to download.

---

## 2. M4 — built, not verified

| # | Item | Who |
|---|---|---|
| 2.1 | **Measured on 2026-08-25, and the criterion was wrong.** See §2a. The wait is now defined as stop-to-card and must not grow with how long the person spoke. | Reopened as 2.4–2.6 |
| 2.4 | **Transcribe while recording, not after.** Worth less than it looked: transcription turned out to cost about the same for 21 s and 29.7 s of audio, so it is a fixed cost rather than one that grows. Whisper pads every clip to a 30-second window. Still the right shape eventually; no longer urgent if Parakeet lands. | §1c first |
| 2.7 | **Try Parakeet on the device.** 4.6x faster on the desktop and reads better by hand. Same library, same adapter seam. | §1c |
| 2.5 | Do not hold the card for the observation. | **Done.** On the measured take that was 2.5 s instead of 7.3 s. |
| 2.6 | **Raise the 60-second recording ceiling.** If a typical entry is twenty seconds, a bad day runs forty or fifty, and cutting someone off mid-thought is the worst thing the app could do at that moment. | — |
| 2.2 | Check the dark theme on a real screen. §7.10 warns the green confirmation and the teal accent sit close in tone. | Owner |
| 2.3 | **Decide what a crisis entry shows.** The domain nulls `observation` correctly, but §6 says what appears instead is a product decision. The card currently shows nothing. | Owner |

---

## 2a. Where the wait actually goes — 2026-08-25

Measured on the phone, second take of the session, so the model was already
loaded:

```
transcribe (29.7 s of audio)   7861 ms
claude-haiku-4-5               1955 ms
claude-sonnet-5                3875 ms
```

The two model calls run together, so analysis costs 3.9 s rather than 5.8.
Total to the card, about 11.8 s.

**Transcription scales with speech: 265 ms per second of audio.** That is the
finding. A twenty-second entry pays 5.3 s before analysis even starts, and the
60-second ceiling would pay 15.9 s. The app charges most for the entries where
someone had the most to say, which is backwards for a product whose point is
teaching people to name what they feel.

**The old criterion measured the wrong thing.** "Capture-to-save under ten
seconds" counted the speaking as part of the cost. Talking is not friction —
it is the person using the product. The brief now budgets everything except the
speaking, and M4 asks for two to three seconds from stop to card, constant
regardless of length.

**Entry length: about twenty seconds**, observed across two people's real
recordings. Two people is not evidence, but it is the only evidence there is,
and it matches what an emotion journal entry sounds like. Short entries stay
valid — §5's second regression case is "Cooked dinner." — they are simply not
what performance is designed around.

**A consequence not yet acted on:** `home.emptyState` still promises "your
first entry takes ten seconds" in both locales. That promise now contradicts
the brief, and it is the first sentence a new user reads. Copy is §7.9's
territory, so the wording is the owner's call.

---

## 3. M5 — not started

**Onboarding now carries the model download.** 547 MB arrives while the user is
being told what the app does and why the microphone is needed. That is the one
moment where waiting reads as setup rather than as the app being slow, and it
lands before the ten-second promise is ever made.

Three things that decision drags in:

- **The wait must not be a wall.** The text path needs no model at all, so
  someone who wants to write their first entry now should be able to, with the
  download continuing behind them. Blocking onboarding on 547 MB over a phone
  connection would lose people at the worst possible moment.
- **Say what is being downloaded and why.** "Luna is downloading the model that
  understands you, so your voice never leaves this phone" is the privacy
  promise and the progress bar in one. §10 is what made that promise true;
  onboarding is where it gets said.
- **A failed or abandoned download is a state, not an error.** Poor connection,
  backgrounded app, no space. The app has to work without the model — text
  only — and pick the download up later.


- Insights screen: free daily trend, paywalled weekly narrative
- Onboarding, with the privacy screen **before** the microphone request
- Settings, with a reminder time picker
- Local notifications
- Paywall and the free/paid boundary
- **Done when:** the boundary matches §6 and nothing in the capture path got slower

**The economics moved.** An entry now costs two calls rather than one, and the
second goes to a dearer model. The observation prompt carries no vocabulary, so
it is far from double — but the free-tier limits have to be drawn against the
real number, not the old one.

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
| 4.12 | `whisper.rn` must be imported as `whisper.rn/index`. Its exports map declares only `./*` and has no root entry, so Metro resolves the short path but TypeScript does not. | Looks like a typo and is not. Commented at the import; shortening it breaks typecheck. |
| 4.13 | The `buffer` polyfill exists only because `whisper.rn` pulls `safe-buffer`, which the bundle cannot resolve without it. | Reached only by `transcribeData`, which nothing calls yet. Streaming transcription will. |
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
