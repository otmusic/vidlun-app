# Vidlun — remaining work

Status as of 2026-08-27. Milestones M0 through M4 are complete and committed,
and M5 has begun: 311 tests, `npm run verify` green.

**M3 is finished.** The voice path runs end to end on a physical iPhone —
record, transcribe on the device, analyse, reflection card.

This file is the running list of what is left. It is not a replacement for
CLAUDE.md, which stays the source of truth for how the product should behave.

The brief now carries nine milestones. M0–M5 are the MVP. M7 (scaffolding fade)
and M8 (voice grounding) are designed but deliberately unbuilt, and each one
requires validation with real people before any code. M6 split on 2026-08-27:
its question moved into the capture card and is now MVP work (§3b), while the
growth view and the way back into old entries stay post-MVP.

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
| **Recordings are kept for a year, then the audio alone is deleted.** | A transcript loses tone, and tone is what a voice journal was for. Suggested by someone who uses emotion journals seriously; the entry survives the audio so history is never thinned. |
| **The wait is measured from stop to card, not from tap to save.** Talking is not friction; waiting is. | The old criterion counted the speaking as a cost to reduce, which is backwards for a journal. See §2a. |
| **The card asks before it answers.** The person names the entry first; Vidlun's version arrives second. | Capture taught nothing: Vidlun named the feeling and the user tapped yes, so after two months there are clean statistics and no growth in self-understanding. The question goes into the pause the analysis already needs, so §1 holds — naming your own feeling is time the person chose to spend, exactly like the speaking. |
| **Numbers are free, prose is paid.** Anything that is arithmetic over the person's own entries is available to everyone; what we pay a model for is not. | §9 forbids gating basic tracking, and the theme counts in the prototype were behind the paywall despite being a count of tags we already store. One rule is easier to hold than a list, and it draws the line where the cost actually is. |
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

## 0a. The rename to Vidlun — 2026-08-27

The product is Vidlun. Renamed in one pass: every mention in the code,
comments, tests, both locale files, `app.json`, `package.json`, both documents,
and the two prototypes, which became `vidlun-*.html`. Verify is green on 311
tests.

The identifier went with it — `com.vidlun.journal` on both platforms — so
`expo prebuild --clean` regenerated the native project as `ios/Vidlun`, and the
build is installed and running on the phone under the new name. The old
`com.luna.journal` is a separate app that stays on the device with its own
journal, recordings and model until someone deletes it; Vidlun starts from an
empty container and downloads the model again.

The directories followed on the same day: `~/idea/vidlun-app`,
`~/vidlun-design`, `~/vidlun-whisper`, and `~/Documents/vidlun-audio` with the
§10 recordings. Older run logs under `~/vidlun-whisper` still print the paths
they were written with; they are records of what happened and stay as they are.

Two things the rename broke in the Ukrainian copy, both fixed with it: the app
referred to itself in the feminine, which the old name was, and `delete.body`
had a verb agreeing with it. Both are present tense now, which §7.9 asks for
anyway. The rest of 4.15 is still owed.

The storage keys went too — `vidlun.entry.`, `vidlun.revision.`,
`vidlun.settings`. That was only safe because the identifier had already moved:
anything written under the old keys sits in the old app's container, which this
build cannot reach. On its own, renaming a key strands the data behind it, and
the comment at `ENTRY_KEY_PREFIX` says so for whoever reaches for the next one.

The repository is `otmusic/vidlun-app` and the local remote points at it.

**What is still Luna:** the app icon and the adaptive-icon assets, which are
the old mark. The new one is still being chosen.

**One trap on a fresh clone.** `ios/` is gitignored and generated, and it is
generated from `app.json` — so the project, the scheme and the identifier all
come from there. There is nothing to rename by hand; `expo prebuild --clean` is
the whole procedure.

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
| 1.7 | **Recalibrate confidence against Parakeet.** The duration bands come from Whisper's error curve and §6 ties emotion depth to them, so a wrong curve makes Vidlun vaguer than it needs to be. | §1c |
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
Raw output in `~/vidlun-whisper/run-2026-08-24-real-v2.txt`.

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
what the guessing costs. Run in `~/vidlun-whisper/run-2026-08-24-real-v3-pinned-uk.txt`.

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
against `~/vidlun-whisper/run-2026-08-24-real-v1.txt` scored worse purely because
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

- Vidlun answered Ukrainian sentences with English observations. The prompt set
  the language of the cleaned transcript and said nothing about the
  observation, which is the only text Vidlun actually says out loud.
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
still reads as fluent nonsense, and Vidlun answers it: "нічойний стих" produced
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
them, including the "нічойний стих" take that made Vidlun invent insomnia, and a
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

## 1d. Is anything better than Parakeet? — surveyed 2026-08-28

Prompted by Gemini 3.5 Transcribe landing on 2026-08-26. Nothing changed as a
result; this is written down so the same ground is not covered twice.

### Canary 1B v2 — checked in the source, it will not load

The obvious candidate: NVIDIA, same 25 European languages as our Parakeet,
larger, and it takes an explicit source language where Parakeet only
auto-detects — which §1b showed going wrong on short takes. A ggml port exists.

**`whisper.rn` cannot load it, and no version bump fixes that.** In the bundled
`cpp/parakeet.cpp` the architecture enum holds exactly two values, `UNKNOWN`
and `TDT`, and the loader does not detect an architecture at all — it assigns
one:

```c
hparams.arch = PARAKEET_ARCH_TDT;
```

The tensor map agrees: 123 encoder entries, 12 predictor, 18 joint. That is
RNN-T and nothing else; the only four mentions of "decoder" are the predictor's
own LSTM. Canary is a FastConformer encoder with a cross-attending Transformer
decoder, so its tensors are not in the map and the load fails on the first name
it looks for. The port even carries a TODO wondering whether other versions
exist — support for them was never intended.

Trying Canary therefore means replacing `whisper.rn` with another native
runtime (CrispASR, parakeet.cpp). That is a project with its own prebuild,
pods and bugs, not a model swap. Checked against 0.7.3; latest is 0.7.4, a
patch.

### Parakeet TDT 1.1B — English only

Looked like a free upgrade from our 0.6B. It is not multilingual; `0.6b-v3` is
the multilingual one in that family. Nothing to do here.

### The specialised Ukrainian models are a trap

`egorsmkv/speech-recognition-uk` benchmarks them on Common Voice 10: Citrinet
1024 at **4.32% WER**, FastConformer P&C at 4.52%, against a Ukrainian-tuned
Whisper large-v2 at 13.72%. Three times better on paper.

They are all **monolingual**, and §1 says our audience mixes Ukrainian and
Russian inside one sentence. A model that is excellent on clean read Ukrainian
and lost on a Russian word mid-phrase can easily be worse in this app than a
multilingual one that is mediocre at both. No ggml path for them either.

### Gemini 3.5 Transcribe — good, and not ours to take

85+ languages including `uk-UA` and `ru-RU`, mid-utterance code-switching,
2.6% WER non-streaming overall and 5.04% on multilingual FLEURS. Roughly
**$0.005 per audio minute**, which is about five cents a month for someone
writing daily — less than the Haiku and Sonnet calls that entry already costs.
It also strips filler words and repairs self-corrections, which is most of what
our transcript-repair prompt does (see 1.8).

**The cost objection in §9 is simply out of date.** The privacy one is not, and
it now has a second life: the onboarding screen we shipped says the voice never
leaves the phone. Moving to cloud STT is not a model swap, it is a change to a
promise people have read — which is what §10 means by revisiting it "at the
price of the privacy promise". It would also end offline use.

### What is actually left

Two candidates, and the choice between them is a product decision rather than a
technical one. Before it can be made honestly, the hole from §1c has to be
filled: **Parakeet has never been measured.** It was chosen by ear, on the
owner's judgement as a native speaker, which was enough to close §10 and is not
enough to compare against a number.

The run to do, on the 17 labelled real takes in
`~/vidlun-whisper/recordings-real` with the harness that produced Whisper's
0.330: Whisper as the fixed point, **Parakeet for the first time as a number**,
Gemini as the ceiling. Half a day and a few cents. If Parakeet lands anywhere
near the cloud, the question closes for good and in our favour.

---

## 1e. Gemini in front of Parakeet — built 2026-08-28

The owner decided what §1d left open, and decided it both ways: **Gemini 3.5
Transcribe when there is a connection, Parakeet when there is not.** Voice
never depends on the network, and the recogniser that answers is chosen per
take rather than per install.

### How the choice is made

There is no connectivity check, and that is deliberate. A flag saying the radio
is up answers a different question, and it is wrong exactly where being wrong
costs most: a captive portal, a bar of signal carrying no packets, an airport
network that resolves DNS and nothing else. The request is the test. It carries
a 12-second deadline, and missing it means what having no connection means —
run Parakeet. This also kept the promise in absolute rule 5: no new dependency
was needed for it.

`CloudFirstTranscriptionService` owns the decision; neither recogniser knows
about the other. `prepare` opens the local model either way, so a fallback
costs the transcription and not the ten-second load as well — half a gigabyte
read on a connection that was about to hold is cheaper than a cold model in
front of someone who has already waited out a timeout.

An empty cloud transcript counts as a failure and goes to the phone too. It is
equally "nothing was said" and "the cloud heard nothing in audio Parakeet can
read", and only one of those is worth throwing an entry away for.

### First numbers on the phone — 2026-08-28

Three real takes, iPhone 14 Pro, Wi-Fi:

```
35.6 s of audio   4069 ms
24.8 s of audio   4224 ms
20.2 s of audio   4245 ms
```

**The cost is fixed and it is not the upload.** Time does not grow with the
audio — it falls slightly, so a take twice as long is free. Compressing to AAC
before sending would buy nothing; only streaming (2.4) touches this number, and
that is a different architecture.

Against Parakeet's 2121 ms, also fixed, **the cloud costs about 2x on the one
number M4 is defined by.** Stop-to-card was 4.0 s and is now near 6 s. That is
the price of the swap, and nothing in these three takes has yet shown what it
buys: Parakeet was never run on this same audio.

`open model` came in at 900-942 ms, not the ten seconds the brief inherited
from Whisper. Warming both recognisers in `prepare` costs almost nothing, so
the fallback stays instant.

**Accuracy, three takes deep and therefore not a measurement.** The owner's
first take — sent before language codes were — dropped a word and misheard
`the word for "anxious"`. The two after it, with `language_codes: ["uk-UA", "ru-RU"]`,
came back exact. The codes are documented as hints that leave code-switching
alone, so they cost nothing either way, but one take against two proves
nothing on its own.

The repair prompt was cleared of the suspicion it was under: on a verbatim
transcript carrying `e-e` fillers and a broken clause, it removed the fillers
and left the clause standing, which is exactly §1's rule. Gemini's own smart
mode would duplicate that work under rules we cannot see, which is why it
stays off.

### The run §1d asked for, done — 2026-08-28

16 labelled real takes, `~/vidlun-whisper/recordings-real/audio`, one harness:
`scripts/transcription-benchmark.mjs`. Gemini goes through the app's own
adapter, compiled rather than copied, so what is measured is what ships.
**Parakeet is a number for the first time.**

Fifteen takes, not sixteen: the free-tier key ran out of requests and take-16
never got a cloud answer. The table is the fifteen all three engines finished,
so the columns compare.

| | whisper q5_0 | parakeet q8_0 | gemini verbatim |
|---|---|---|---|
| mean WER | 0.242 | 0.216 | **0.182** |
| median WER | 0.167 | **0.091** | 0.118 |
| Ukrainian (9) | 0.254 | 0.260 | **0.237** |
| Russian (3) | 0.282 | 0.190 | **0.116** |
| mixed (3) | 0.163 | 0.109 | **0.084** |
| exact transcripts | 2/15 | **5/15** | 2/15 |
| takes over 0.4 | 3/15 | 2/15 | **1/15** |
| desktop s/take | 2.37 | **0.52** | see below |

**Gemini wins the average, Parakeet wins the middle.** Gemini is ahead on every
language and has the fewest disasters; Parakeet is exactly right more than
twice as often as either. The two facts are consistent: Gemini is more evenly
good and rarely far wrong, Parakeet either nails a take or drops a word.

Wall time from this run is not comparable for the cloud rows — the quota pause
in front of each request was inside the measurement, which is a harness bug now
fixed. The phone numbers stand as the latency figure: Gemini ~4.1 s fixed
against Parakeet's ~2.1 s.

**The one that should worry us is take-02.** "Приготував вечерю" — two words,
badly recorded, and all three failed it. But they failed differently:

```
whisper    Прогутового вечера.
parakeet   Правут о вечерню.
gemini     Доброго вечора.
```

The local two produced visible nonsense. Gemini produced a fluent, ordinary,
completely wrong sentence — and it is the only one of the three the repair
prompt cannot catch, because that prompt's whole test is "is this a word in any
language". "Доброго вечора" passes that test and reaches the analyzer as an
evening greeting. **A better recogniser fails more dangerously, not less**, and
that is an argument about safety rather than accuracy.

Reading the rest: on take-12 Gemini alone got both "схвильований" and "свій
додаток" right where Whisper invented "халюваний"; on the Russian take-08 it
was clearly best. Some of its losses are reference drift, the same charge
Parakeet took in §1c — it transcribes the "Так," at the start of a take that the
written reference left out, and WER bills it.

### Smart mode measured, and it is not for us — 2026-08-28

Run again on a second key, both modes, the 13 takes that survived the quota:

| | whisper q5_0 | parakeet q8_0 | gemini verbatim | gemini smart |
|---|---|---|---|---|
| mean WER | 0.256 | 0.233 | **0.195** | 0.442 |
| median WER | 0.167 | **0.091** | 0.125 | 0.167 |
| takes over 0.4 | 3 | 2 | **1** | 2 |

The first impression — that smart returned text identical to verbatim — was an
artefact of three takes it happened to leave alone. It changes six of thirteen,
**and four of the six get worse.** The two it improves are ordinary sentences;
what it does to the hard ones is a different kind of failure:

```
said      Норм.
verbatim  Норм.
smart     नॉर्म

said      Приготував вечерю.
verbatim  Доброго вечора.
smart     Prostovoljci.

said      ...і схвильований...
verbatim  Проживаю схвильований
smart     Проживаю в Схльовані
```

Devanagari for a one-word Ukrainian take, a Slovenian noun for a two-word one,
and an adjective turned into a place name. Smart mode is optimising for a
readable sentence, and on a short or noisy take the most readable sentence is
one nobody said. That is the same failure as `Доброго вечора`, further along:
**fluency is what makes a wrong transcript dangerous here**, and this mode buys
more of it.

Verbatim stays. The repair the product needs is the one whose rules we write.


### The fallback, seen working — 2026-08-28

Not simulated: the benchmark had exhausted the key, so the next take on the
phone met a real 429.

```
[vidlun] open model 991ms
[vidlun] transcribing on the phone instead: ...the service answered 429
[vidlun] transcribe (16.3s of audio) 1985ms
[vidlun] heard: Сьогодні кіт знову сходив в туалет з жидким стулом...
```

**1985 ms for the whole path** — the refusal plus Parakeet, which is what
Parakeet costs alone. Nothing on screen said the recogniser had changed, which
is the point. One caveat: a rejection returns immediately, where a dropped
connection would spend the 12-second deadline first and only then start the
local model.

### The repair prompt breaks §1, and now there is a log line proving it

The same take, one stage later:

```
heard:     ...з жидким стулом...
repaired:  ...з рідким стулом...
```

The speaker said `жидким`. The prompt turned it into the Ukrainian word. §1
forbids exactly this — a Russian word inside a Ukrainian sentence is how this
person talks, and converting it is named there as the one thing the app must
never do. The licence covers runs of letters that are not words in any
language; `жидким` is an ordinary Russian word and should have survived
untouched.

This is the owner's original complaint, correctly addressed: the first take of
the day lost `нову` and misheard a word, and both were laid at the recogniser's
door. The recogniser was not the author. **1.8 stops being a question about
whether the repair still earns its risk and becomes a bug**: the prompt is
doing something its own rules forbid, on a transcript clean enough that it had
nothing legitimate to fix.

### What was left alone

- **Smart mode is off.** Gemini's own filler-word removal and self-correction
  repair overlap with what the analyzer prompt does under rules written for
  this audience — a Russian word inside a Ukrainian sentence is how the person
  talks and must survive. Two repairs in a row, one of them not ours to tune,
  is how someone's words quietly become someone else's. Measure before
  enabling; this is 1.8 again, now with a second candidate.
- **No language hint.** Gemini detects per utterance, and naming one language
  is exactly what breaks a sentence that switches halfway.
- **Confidence is a flat 0.9 on the cloud path**, asserted rather than
  measured. The duration bands mean nothing against 2.6% WER, but nothing here
  is measured either — 1.7 now covers both recognisers.

### What this owes

- **The copy.** `onboarding.privacyOnDevice` — "your voice is never sent
  anywhere" — is deleted, key and all, because it stopped being true. Nothing
  replaces it yet. That line is a product decision and it blocks release, not
  the build: the privacy step currently says what is kept and what can be
  deleted, and says nothing about where recognition happens.
- **The measurement §1d asked for is still not done.** Parakeet has never been
  a number. It now matters more, not less: the fallback path is the one nobody
  will watch.
- **The key ships in the bundle**, exactly like the Anthropic one, and moves
  behind the same proxy — see the debt note in `src/di/config.ts`. Unlike the
  Anthropic key it is optional: without `EXPO_PUBLIC_GEMINI_API_KEY` the app is
  on-device only and everything still works.

---

## 1f. The repair prompt, fixed as far as prose goes — 2026-08-28

§1e caught the analyzer converting `жидким` to `рідким` on a transcript that
needed no repair at all. Restating the rule was not an option: the prompt
already forbade this three times, in three different sentences.

`scripts/repair-check.mjs` runs the real analyzer over
`~/vidlun-whisper/repair-cases.tsv` — five transcripts that must come back word
for word, one that may legitimately be repaired, one that is only fillers — and
prints every word added or dropped. A run is read, not scored: a legitimate
repair and an act of invention look identical to a diff.

**What was actually wrong**, none of it a missing rule:

- **The premise was out of date.** "It came from speech recognition that is
  weak at Ukrainian, and it *will* contain words the speaker never said" was
  true of Whisper and instructs the model to go looking. Replaced with the
  truth — recognition is usually exact, and returning the sentence untouched is
  the most common correct answer.
- **There was no default.** Every line described how to repair; none said that
  most transcripts need nothing.
- **"False starts removed" was a licence to drop words.** That is how `Тестую
  нову модель` became `Тестуємо модель`. Only fillers are removed now.
- **The prohibitions were too broad to bite.** "Do not tidy the grammar" does
  not obviously cover re-personing a verb. Named individually now.
- **Surzhyk was not covered by the rule at all, and this is the substantive
  find.** `полний` and `равно` are not Russian words — Russian is `полный`,
  and `всё равно` — so under "change only a run of letters that is a word in no
  language" they were fair game, and the model was obeying. Everyone this app
  is for speaks that way constantly. The prompt now says a word of one language
  carried into the other and written as it was said is a real word.

**Before: three forbidden conversions across the set. After, five runs on each
model:**

| | forbidden conversions | licence exercised |
|---|---|---|
| haiku-4-5 | 3 of 5 runs (`полний`) | never |
| sonnet-5 | **0 of 5** | 2 of 5 (`нічойний`) |

`жидким`, `всьо равно`, `нову`, the Russian sentence and `Норм.` are stable on
both. What separates them is `полний`, and it is not variance: Haiku breaks it
about half the time and Sonnet never did.

What Sonnet changes instead is `нічойний` — a genuine non-word, the one case
the licence exists for. It is allowed to touch that. It guesses wrong (`нічний`
for `нічого не встиг`), but a wrong guess inside the licence is a different
class of failure from rewriting a word the person said.

**A fourth iteration made it worse and was reverted.** Turning the surzhyk rule
into an ordered gate in front of the non-word test broke `жидким`, which had
been solid. That is where prose stopped paying.

**So the residue is model capacity, not wording,** and the decision is whether
`REFLECTION_MODEL` moves to Sonnet. `claudeModels.ts` already records Haiku
writing ungrammatical Ukrainian, which is why the observation moved; this is
the same finding reaching the other call.

The objection is the capture path, and it is weaker than it looks. Measured on
the phone the same day: Haiku's analysis ran 1768-2991 ms, and Sonnet's
observation — a different prompt, so not a clean comparison — ran 1417-1851 ms
on two of three calls. Sonnet is not obviously the slower one here. Settling it
needs an A/B on the device, not another desktop run.

### 1.8 answered: the licence is gone — 2026-08-28

Sonnet was measured on the phone before anything was decided: **analysis went
from 2.2 s to 6.8 s**, three takes at 8015, 7489 and 5014 ms against Haiku's
1768-2991. Stop-to-card is untouched, because §3b's card asks its question off
the transcript and the analysis runs behind it — but the wait moved to just
after the person answers, where Haiku's 2.2 s had been hidden by the answering
itself and 6.8 s will not be.

So the choice was never Haiku against Sonnet. **The rule Haiku kept breaking
was the repair rule, and the repair rule had stopped earning its place.** The
recognisers now return clean transcripts; over five runs Haiku never once used
the licence, and Sonnet used it twice and was wrong both times, turning
`нічойний стих` into `нічний стиль` where the truth was `нічого не встиг`.

The licence is withdrawn. `cleanTranscript` is now the sentence as it arrived,
hesitation sounds removed and nothing else — no recovery of a misheard word
from its sound, however plain it looks. The owner decided this on the numbers
above; the model went back to Haiku with it, and `claudeModels.ts` carries the
reason.

**Ten runs of `repair-check.mjs` on Haiku after the change: not one word
rewritten.** The one thing that is not reliable is the deletion that remains —
hesitation survives in about one run in five. That is the benign direction to
fail in, and worth knowing rather than fixing by force: two attempts to word it
more strongly first suppressed the deletion entirely (5 runs, one removal), and
naming it as a step someone performs brought it back to 8 of 10.

**What was given up**: `клот` -> `Клод`, which the licence got right on a live
take an hour earlier. Real recognition errors now reach the person as they
came. That is the trade, taken deliberately: a strange word left standing can
be read past, and a fluent invented one cannot even be noticed.

---

## 2. M4 — built, not verified

| # | Item | Who |
|---|---|---|
| 2.1 | **Measured on 2026-08-25, and the criterion was wrong.** See §2a. The wait is now defined as stop-to-card and must not grow with how long the person spoke. | Reopened as 2.4–2.6 |
| 2.4 | **Transcribe while recording, not after.** Worth less than it looked: transcription turned out to cost about the same for 21 s and 29.7 s of audio, so it is a fixed cost rather than one that grows. Whisper pads every clip to a 30-second window. Still the right shape eventually; no longer urgent if Parakeet lands. | §1c first |
| 2.7 | **Try Parakeet on the device.** 4.6x faster on the desktop and reads better by hand. Same library, same adapter seam. | §1c |
| 2.5 | Do not hold the card for the observation. | **Done.** On the measured take that was 2.5 s instead of 7.3 s. |
| 2.6 | Raise the 60-second recording ceiling. | **Done, and for a bigger reason.** Silence auto-stop is gone entirely — the person decides when a take ends — so the ceiling had to move past any real entry rather than just past a long one. Five minutes, and it exists only so a recording left running in a pocket cannot fill the disk. |
| 2.2 | Check the dark theme on a real screen. §7.10 warns the green confirmation and the teal accent sit close in tone. | Owner |
| 2.3 | **Decide what a crisis entry shows.** The domain nulls `observation` correctly, but §6 says what appears instead is a product decision. The card currently shows nothing. One candidate answer is in §2c. | Owner |

---

## 2c. Idea: a helpline number on a hard entry — 2026-08-28

**Not scheduled, not decided.** Written down because it is the first concrete
answer anyone has offered to 2.3, and because the ways it can go wrong are
easier to see now than in a hurry later.

The idea: when an entry comes back flagged as anxious or genuinely hard, show
the crisis line for the country the person is in, alongside whatever else the
card does.

**What makes it worth doing.** A person who has just said the worst thing out
loud has already done the hardest part. The number being there — not searched
for, not asked for — is the difference between a thought and a phone call, and
that is a difference this product is unusually well placed to make: it is the
only moment we know for certain what somebody just said.

**What makes it dangerous, in the order the problems bite:**

- **A wrong number is worse than none.** Someone in trouble dialling a line
  that is dead, moved, or answers in a language they do not speak is worse off
  than someone who was shown nothing. Whatever table ships has to be right on
  the day it is dialled, which means it needs an owner, not just an author.
- **Which country, and how do we know?** The phone's region is where the device
  was set up, not where the person is standing, and a Ukrainian abroad may want
  the Ukrainian line rather than the local one. Getting this from the network
  would mean sending something about a crisis entry off the device, which is
  the one thing §9 does not allow. A bundled table plus the phone's region,
  with the country visible and changeable, is the honest version.
- **On which flag.** Showing a suicide line after "this traffic is infuriating"
  is alarming, faintly insulting, and teaches people that the app panics — after
  which they will not believe it on the day it matters. `crisis` only, and the
  threshold for that flag is already meant to be conservative. `distress` has
  the grounding exercise (M8) and should keep it.
- **Tone.** It cannot read as the app filing someone as a case. No alarm colour,
  no icon shouting, no "we noticed you may be at risk" — that sentence is a
  diagnosis, which §7.9 forbids, and it arrives at the worst possible moment
  for one.
- **Nothing about it may be logged.** Not that it was shown, not that it was
  tapped. A journal that records whether you looked at a crisis number is not a
  journal anyone should keep.

**Before any of it is built:** the copy and the trigger both need review by a
mental health professional, the same as M8's. This is the one screen in the
product where being wrong has consequences outside the app.

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

## 2b. Keeping the audio — built 2026-08-25, one piece left

Journal recordings are kept on the device for one year, then the audio file is
deleted and the entry stays whole. The grounding exercise is untouched by this
and still saves nothing.

| # | Item | State |
|---|---|---|
| 2b.1 | Somewhere that is not the cache. | **Done.** `Documents/recordings`, written by `FileRecordingStore`. |
| 2b.2 | A way to reach an entry's recording. | **Done.** Keyed by entry id inside the store; `MoodEntry` never gained a file path, and the take is held in the capture flow until it is confirmed or abandoned. |
| 2b.3 | The sweep. | **Done.** `ForgetOldRecordings` runs when the app opens rather than on a schedule — a recording a few days past its year harms nobody, and a background job would be a thing to maintain and no way to test. |
| 2b.4 | Entry deletion. | **Done.** Hold a row, confirm. Takes the recording and the revision log with it. |
| 2b.5 | Playback. | **Done.** On the detail screen. A finished track rewinds before replaying, or the second tap reads as broken. |
| 2b.8 | An entry detail screen. | **Done.** Reached by tapping a row in history. Same chips as the reflection card, from a shared component, so an entry looks the same a month later as the day it was saved. |
| 2b.6 | The setting. | **Done.** In settings, not at onboarding. Defaults to keeping. Switching it off deletes what is already kept, and says so first. |
| 2b.7 | Onboarding copy. | **Done.** The privacy screen says recordings stay a year and the written entry stays for good. "Nothing is kept" stopped being true when we decided to keep the audio, and this is where that gets said rather than discovered. |

**Kept as WAV, deliberately.** Roughly 32 KB a second, so a daily habit
approaches 360 MB before the sweep starts reclaiming. Compressing would mean
adding something that transcodes, and the year bounds the total either way.
Revisit when the number starts mattering, not before.

**Untested on hardware:** the sweep has never had a year-old file to delete.
Its arithmetic is covered; its effect on real files is not.

**Two open questions worth answering before building.**

*Format — decided: keep the WAV.* Transcription needs 16 kHz mono WAV, about
32 KB per second, so a 30-second entry is nearly a megabyte and a daily habit
reaches roughly 360 MB before the one-year sweep reclaims anything. AAC would
be a fraction of that, but nothing here transcodes and adding something that
does is a dependency decision. Storing what the recorder already produced costs
no new moving parts; compression is an optimisation to make when the number
starts mattering, and the sweep bounds it either way.

*Backups.* §9 says backups are never paywalled. Audio makes a backup two orders
of magnitude larger than the entries, which turns a settled decision into an
open one.
---

## 3. M5 — begun

**Onboarding is built.** Three screens in §8's order: what this is, what
becomes of your voice, and only then the microphone. Asking for a microphone
before saying where the recording goes is the moment people decide an app
cannot be trusted.

Nothing in it gates anything. The model download shows its progress in
megabytes and blocks nobody — the text path needs no model, and half a gigabyte
over a phone connection is the wrong thing to make someone wait for before
their first entry. The microphone answer does not gate either: declining leaves
a working text journal, and asking twice would be worse than either outcome.

**Still owed:**

- Insights screen: designed but unbuilt, see §3c
- Local notifications and the reminder picker — the settings screen exists
  (§3a) and has room for the row
- Paywall and the free/paid boundary
- **Done when:** the boundary matches §6 and nothing in the capture path got slower

**Not yet seen working:** a download from nothing. The model was pushed to the
device by hand before onboarding existed, so the progress line has never had
real bytes behind it, and a failed or abandoned download — poor connection,
backgrounded app, no space — has never happened on hardware. Uninstalling and
reinstalling is the only way to find out.

**The economics moved.** An entry now costs two calls rather than one, and the
second goes to a dearer model. The observation prompt carries no vocabulary, so
it is far from double — but the free-tier limits have to be drawn against the
real number, not the old one.

`GetWeekSummary` and `ClaudeNarrativeGenerator` already exist from M2 and M3.
What is missing is the screen and the entitlement check.

The onboarding privacy copy depends on 1.3. Writing it before the §10 result is
known risks writing a promise the STT cannot keep.

---

## 3a. Built ahead of M5 — 2026-08-25

Three screens that were not on the milestone list, each pulled in by the
decision to keep recordings.

- **History.** Deletion could only reach the handful of entries Home shows,
  which becomes a hole the moment insights start counting months a person
  cannot reach into. Grouped by day in the use case, because local midnight is
  the same boundary the streak counts against and a use case can be tested in
  plain Node while a component cannot.
- **Entry detail.** Emotions, tags and observation were unreachable once an
  entry scrolled off Home, and the audio had nowhere to be played.
- **Settings.** Carries the recordings switch and the language choice. No
  reminder row: notifications are not built, and an empty setting is worse than
  a missing one.

What M5 still owes: insights, notifications, the reminder picker, the paywall
and the free/paid boundary. Onboarding has since been built (§3).

---

## 3b. The card asks before it answers — designed 2026-08-27, not built

The reflection card changes shape. Instead of opening with what Vidlun heard, it
opens with a question — the person names the entry first, and Vidlun's answer
arrives second, as a comparison rather than a verdict.

**Why it does not cost the capture path anything.** Stop to card is 4.0 s today
(§1c): 2.1 s of transcription, then 1.8 s of Haiku, with Sonnet's 4.0 s already
arriving behind the card rather than holding it. The question needs only the
transcript, so it can be on screen at 2.1 s — and the classification lands
while the person is reading it. Added wait: none, and the first thing they see
arrives about two seconds sooner than the card does now. Added taps: one. The
time spent choosing a word is the person's own, on the same argument §1 makes
about the speaking.

The screen is specified in full — three states, the copy, the leak rules, the
four difference cases, the edge cases and the tokens:
<https://claude.ai/code/artifact/c78bd99f-6192-479f-9091-50a4aa7aebbd>

| # | Item | State |
|---|---|---|
| 3b.1 | `selfEmotionIds` on `MoodEntry`. | **Done.** Defaults to empty rather than to either of the other two: an entry made with the question switched off has no unaided answer, and filling it in from what was kept would count Vidlun's vocabulary as the person's. Stored and read back; records written before the field exists read as empty for the same reason. |
| 3b.2 | `proposedEmotionIds` must stop defaulting to `emotionIds`. | **Not needed, and the item was wrong.** It assumed the draft would be built from the person's answer. It is not: `CreateVoiceEntry` still builds it from the analysis, and the unaided answer arrives beside it as `selfEmotionIds`. So at creation `emotionIds` really is Vidlun's proposal, and the default is exact. 4.11's lenient fallback stands for the same reason. |
| 3b.3 | **Two card states in `useCaptureFlow`**: question, then comparison. | **Half done.** `TranscribeTake` is split out of `CreateVoiceEntry`, so the words exist before the analysis starts and the card has something to ask about. The stages themselves are next. |
| 3b.4 | **Nothing of the answer may leak before it is given** — not the observation, the mood, the context tags, nor the number of chips. Worth a test: it is the one defect that would never be noticed in use. | Not started |
| 3b.5 | **Four difference cases**, including "Vidlun missed what you named". Copy lives in the locale files, never in the analyzer. | Not started |
| 3b.6 | **Disagreement is logged separately from a revision.** A person who keeps their own word is not correcting a mistake, and the two must not land in one bucket. | Not started |
| 3b.7 | **`distress` and `crisis` skip the question** and go straight to the card. | Not started |
| 3b.8 | **The settings switch.** Off means the card is exactly what it is today, at exactly today's speed. | Not started |
| 3b.11 | **The picker has to reach depth 3.** A tap on an already-chosen chip opens its children and only those, under a quiet "точніше?" line; choosing a child replaces the parent rather than spending a second slot. Without this the deepest words are unreachable by construction, and the vocabulary screen ends up measuring our own ceiling. It is also the drill-down §6 already relies on for sensitive states. | Not started |
| 3b.9 | **Re-measure the wait to the question**, not to the card. Only the transcript gates it, so it should land near 2.1 s — inside what M4 asks for, which 2.1 is still open on at 4.0 s. | Ties to 2.1 |
| 3b.10 | **Prototype.** `guess` and `reveal` already exist in `design/vidlun-prototype.html` for the old M6 flow. Drop the "1 / 3" counter, which has no meaning during capture, and bring the question to the display size — it is drawn at 19px, which is off the scale. | design/ |

**What this does not change.** Reflection mode stays entirely optional, the
growth view and emotional granularity stay post-MVP, and the invitation on Home
stays — but for entries already saved, as the way back into an old one.

---

## 3c. The statistics screen — designed 2026-08-27, not built

M5 owes an insights screen. It is designed as one screen with two registers:
**the week** (what happened) and **the vocabulary** (how the person's language
is changing). The second is the one this product is actually for.

Full spec — three mockups, the chart rules, the empty states, the copy with
i18n keys, and what still has to be computed:
<https://claude.ai/code/artifact/066ac3a2-fc3c-46d6-a7dd-497eb29565b0>

**The four positions it takes**, each of which the prototype does differently:

- **No headline number.** An average of feelings means nothing and reads as a
  verdict.
- **A day without an entry is not a bad day** — straight out of
  `GetWeekSummary`, where it is already `null`. It draws as a dot on the
  baseline, never a short bar and never a mood colour.
- **The chart comes before the narrative**, for both tiers. A free screen that
  opens with a lock is hostile, and this also settles §7.10's fold problem by
  putting the shorter element first.
- **Precision is shown in words, not as a level.** Three progress tracks
  labelled basic / refined / specific are our own vocabulary and read as a
  grade. The screen shows pairs instead — happy → proud, angry → annoyed — so
  it says *what the person now distinguishes* and never *how high they climbed*.
  Depth is tied to confidence in §6: praising depth would teach people to
  over-specify, which is the fabricated-insight failure from the other side.

| # | Item | State |
|---|---|---|
| 3c.1 | The week: chart, entry count, narrative, lock. Everything it needs already exists in `GetWeekSummary`. | Not started |
| 3c.2 | Week navigation. `containing` is already an input; there is no screen. Never forward past this week, never back past the first entry. | Not started |
| 3c.3 | Theme counts — a use case over `contextTags` for the week. Free, per the boundary above. | Not started |
| 3c.4 | The entitlement check and what the locked state shows. Ties to the paywall, which M5 also owes. | Not started |
| 3c.5 | Patterns. A separate model call; the response shape is not designed. | Not started |
| 3c.6 | The vocabulary half: words used for the first time, refinement pairs from `parentId`, distinct words per month. Waits on `selfEmotionIds` (§3b). | Blocked on 3b.1 |
| 3c.7 | Prototype: `insights`, `locked` and `growth` now differ from the spec — themes move out of the lock, the monthly bars go, depth tracks become pairs. | design/ |

---

## 4. Deliberate debt

| # | Debt | Why it matters |
|---|---|---|
| 4.1 | **The Claude api key ships inside the bundle.** `EXPO_PUBLIC_*` is inlined and can be extracted from the app. | Release blocker. The fix is a thin proxy; only the adapter's base URL changes. |
| 4.2 | Metro resolves `node:*` to an empty module so the Anthropic SDK can bundle. A Node built-in reaching a live code path would become a confusing runtime error instead of a build error. | Goes away with 4.1. |
| ~~4.3~~ | **Closed.** The locale is detected from the phone on a first run, chosen in settings, and remembered. Detection is consulted once: changing the phone's language later must not undo a choice someone made. | |
| 4.4 | Safe area is a fixed 64pt top pad rather than a measured inset. | Visible on notched devices. |
| 4.12 | `whisper.rn` must be imported as `whisper.rn/index`. Its exports map declares only `./*` and has no root entry, so Metro resolves the short path but TypeScript does not. | Looks like a typo and is not. Commented at the import; shortening it breaks typecheck. |
| 4.13 | The `buffer` polyfill exists only because `whisper.rn` pulls `safe-buffer`, which the bundle cannot resolve without it. | Reached only by `transcribeData`, which nothing calls yet. Streaming transcription will. |
| 4.14 | **History reads the whole journal in one query.** No worse than what `findRecent` already did — the stored repository always read everything — but a person with a year of daily entries is several hundred records parsed on every open. | Fine now, and the first thing to feel slow. Paging when it does, not before. |
| 4.5 | Streak plurals are simplified; Ukrainian plural rules are not implemented. | Cosmetic. |
| 4.15 | **The shipped copy assumes the reader's gender, and picks a different one in different places.** `processing.thinking` addresses a man; the prototype addresses a woman. Ukrainian past-tense verbs carry the addressee's gender, so half the audience reads a line written about somebody else. | §7.9 now requires the present tense. A sweep of `uk.json`, and the English keys have to be phrased so the translation can avoid the past tense at all. |
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
