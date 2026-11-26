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
| Fonts are built into the binary through the `expo-font` config plugin, five files in `assets/fonts/` named by PostScript name (since 2026-09-09; before that `@expo-google-fonts` loaded them at launch). | Loading at launch gated the first frame on five file reads after the splash; embedded, they are there from the first frame and both platforms register the same family names. |
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

### The 4-bit files, measured — 2026-09-16

Asked because the owner wants the Ukrainian model inside the app binary
rather than downloaded, and 669 MB is too much to ship to everyone. Same
16 labelled takes, same `parakeet-cli`, `scripts/transcription-benchmark.mjs`
now takes `--parakeet-models q4_0,q4_k,q8_0`.

| | q4_0 (356 MB) | q4_k (416 MB) | q8_0 (669 MB) |
|---|---|---|---|
| mean WER | 0.155 | 0.154 | 0.212 |
| median WER | 0.091 | 0.125 | 0.125 |
| Ukrainian mean (9) | 0.150 | 0.118 | 0.260 |
| mixed mean (4) | 0.138 | 0.180 | 0.119 |

**No cliff at four bits.** The three disagree on seven takes and no file is
consistently better; the differences read like decoding noise. q8_0's mean
is the worst only because it turned "Приготував вечерю" into "Правут о
вечерню" (WER 1.5 on two words) where q4_k had it exactly and q4_0 lost one
letter ("вечер"). Read by the product's own rule — a real word in the wrong
form costs nothing, an invented one costs the entry — q4_0 comes out at
least level with q8_0: its misses are dropped letters and one mangled
opening ("На чеквис повсякзав" for "Ой наче як виспався", a take all three
mangle), while q4_k substituted a real word once ("не стих" for "не встиг").
So q4_0 is the file to ship if the model ships inside the app: 356 MB,
quality indistinguishable from what 1.0 and 1.1 run.

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

## 1d′. Is anything better than Parakeet yet? — surveyed again 2026-09-16

Asked by the owner the evening 1.2 went to TestFlight with q8_0 in the
bundle. Nothing that fits the app's three constraints — on the phone, one
model for Ukrainian, Russian and English in one sentence, runnable by
whisper.rn — has appeared since §1d. What has:

- **Apple.** macOS 26.6.2's `SpeechTranscriber.supportedLocales` lists 30
  locales: German, English, Spanish, French, Italian, Japanese, Korean,
  Portuguese, Cantonese, Chinese. No Ukrainian, no Russian. The owner's
  phone is on iOS 27.0; nothing announced for 27 adds either.
- **NVIDIA Nemotron 3.5 ASR streaming 0.6B** (June 2026, OpenMDW-1.1):
  40 locales including Ukrainian and Russian, cache-aware FastConformer-RNNT,
  true streaming with 80 ms–1.12 s chunks, punctuation. FLEURS WER 13.07
  on Ukrainian against Parakeet v3's 6.79 — the price of streaming. Runs
  through NeMo, a CrispASR GGUF (458 MB q4_k), or CoreML via FluidAudio
  (iOS 17+); not through whisper.rn. Worth a look when streaming (the M4
  ambition) is on the table, not for accuracy.
- **NVIDIA Canary 1B v2** (with Parakeet v3, Aug 2025): better than
  Parakeet on average (FLEURS 8.40 vs 11.52 across 24 languages), 1 B
  parameters, encoder–decoder; no ggml/whisper.rn runtime, so not on the
  phone.
- **Moonshine tiny uk** (Sept 2025): 27 M parameters, Ukrainian-only, WER
  24.54 on Common Voice per egorsmkv/speech-recognition-uk. Too weak.
- **Ukrainian-only NVIDIA FastConformer hybrid** (`stt_ua_fastconformer_
  hybrid_large_pc`, 4.52 % on Common Voice) and `Yehor/w2v-bert-uk`
  (6.6 %): better on pure Ukrainian, useless for the mixed speech §1 is
  about, and whisper.rn's Parakeet path reads TDT only (`n_tdt_durations`),
  not hybrid RNNT/CTC.
- **Whisper fine-tunes** for Ukrainian (large-v2, 13.72 % on Common Voice):
  1.5 B parameters for a worse number than Parakeet's 6.79 / 5.10 on
  FLEURS / CoVoST.
- **whisper.rn 0.7.4** (Aug 2026): Whisper and Parakeet, nothing else.

**So Parakeet TDT 0.6B v3 stays**, and q8_0 in the bundle is the best of
it. The one thing to revisit is FluidAudio's CoreML Parakeet: the same
model on the Neural Engine, if transcription time on the phone ever needs
to drop below what whisper.rn gives.

---

## 1d″. A better or smaller model? — surveyed a third time 2026-11-10

Asked by the owner after 1.9 (54): is there a better recogniser for
Ukrainian and Russian, and could the app get smaller? The app ships
Parakeet TDT 0.6B v3 q8_0 (669 MB) inside the bundle, about 700 MB
installed.

**The size is already ours to cut.** §1c measured the 4-bit files on the
16 labelled takes: q4_0 (356 MB) and q4_k (416 MB) came out level with
q8_0 (mean WER 0.155 / 0.154 / 0.212; Ukrainian mean 0.150 / 0.118 /
0.260). q8_0 went back in for 1.2 (39) only so the phone would read with
exactly what 1.0 and 1.1 had read with. q4_k would take the app to about
440 MB, q4_0 to about 390, with no new code.

**The one real candidate: Parakeet Ultra** (Moondream, 22 Sept 2026,
CC-BY-4.0, `moondream/parakeet-ultra`). A post-trained v3: same
architecture, tokenizer and 0.6 B parameters, plus a small voice-activity
head on the encoder's subsampler; punctuation and casing as the parent's.
FLEURS, Moondream's card (v3 → Ultra): Ukrainian 5.94 → 4.75, Russian
5.91 → 5.21; Whisper Notes' own run: 6.59 → 5.11 and 6.99 → 5.72. Not the
same pipeline as our takes, but both agree. Published as safetensors for
Moondream's Photon runtime; no GGUF for whisper.cpp/whisper.rn is named.
Worth a try because whisper.rn's loader maps tensors by name for exactly
this architecture: convert to GGUF the way `ggml-org/parakeet-GGUF` was,
drop or ignore the VAD head, quantise to q4, measure. If it loads and
holds, a 4-bit Ultra would be smaller than today's model and more
accurate.

**Looked at and not for us:**
- **QVAC TranscribePsy-250M-EU** (Tether, 14 Oct 2026, Apache-2.0): a
  254 M FastConformer-TDT pruned and distilled from Parakeet v3, 25
  languages with uk and ru. Common Voice WER Ukrainian 41.70, Russian
  14.62 (Whisper-small 46.62 / 16.42); quantised phone builds exist only
  for the 8-language EU-sub, through its own engine. Too weak on
  Ukrainian, and no runtime we have.
- **Meta Omnilingual ASR CTC-300M**: community CoreML/MLX ports at
  193-342 MB, but Common Voice Ukrainian 52.84 and Russian 32.45 in the
  same table. CTC, no whisper.rn path.
- **GigaAM Multilingual** (Sber, InterSpeech 2026, MIT, 220 M / 600 M):
  Russian, English, Kazakh, Kyrgyz, Uzbek. No Ukrainian.
- **Phonon 2 / 2.5** (Fermion): Parakeet v3 derivatives; Phonon 2 is
  English only, 2.5 lists Ukrainian and Russian but publishes no size or
  GGUF we could find.
- **Parakeet Redux** (Moondream's ternary sibling, 178 MB): the size is
  tempting, but per-language results are mixed against v3 and ternary
  weights have no whisper.rn path. Watch, do not chase.
- **Apple SpeechAnalyzer**: still no Ukrainian or Russian on any list
  found for iOS 27; `supportedLocales` on the phone is the only proof.
- **whisper.rn 0.8.0-rc.0 to rc.3** (to 9 Nov 2026): vendoring, VAD,
  realtime fixes; no new architectures, nothing for Parakeet.

**The measuring kit is gone.** `scripts/transcription-benchmark.mjs`
remains, but `~/vidlun-whisper` (the labelled takes, `transcripts.tsv`,
`parakeet-cli` and the model files) is no longer on this Mac. Any of the
above is decided on numbers only once the takes come back from a backup,
or 15-20 new ones are recorded and written out.

---

## 1d⁗. A smaller model on the phone: Ultra converted, 4-bit measured — 2026-11-11

After server recognition was taken back out (§1d‴), the owner asked to
try a smaller on-device model instead.

**Parakeet Ultra in whisper.rn's format, made here.** whisper.rn 0.7.3
carries whisper.cpp 1.9.1's `parakeet.cpp`, which reads the ggml layout of
`ggml-org/parakeet-GGUF`. Ultra (moondream/parakeet-ultra at
73175eb7aeb0d82f1e2a6b53b3aabc10a90bcd0b, safetensors sha256
c9608f36…17dc) was converted with a script of our own that takes the
header (hparams, mel filterbank, STFT window, TDT durations, vocabulary)
and the tensor list from the v3 q8_0 file and fills in Ultra's weights,
renaming the HF transformers layout to NeMo's and applying the official
converter's two transforms (LSTM bias_ih folded into bias_hh, gates
[i,f,g,o] → [i,f,o,g]). Checks: Ultra's 8192 tokens equal v3's in order;
only the six `vad_head` tensors are left out; each of the 721 tensors is
close to v3's (cosine median 1.0000, lowest 0.954 on the last layer's
norm bias), which a wrong name or gate order would break. Quantised with
whisper.cpp v1.9.1's `parakeet-quantize` (built by the owner; building it
from here was refused by the harness as external code): from f32 the
files come out byte-for-byte the size of ggml-org's (q8_0 668,757,119;
q4_k 415,611,879); from f16 the K-quants do not load ("embed.weight has
wrong size"), because the tensors whose 640-wide rows K-quants cannot take
stay in the source type and the loader wants f32.

**Measured with `parakeet-cli` (v1.9.1, Mac) on 27 synthetic takes** —
macOS voices Lesya and Milena, 12 journal-style sentences clean and with
room noise at 12 dB SNR, plus the three from §1d‴. The labelled real takes
are still gone, so this shows whether anything breaks, not which is best:

| model | MB | WER all | clean | noisy | uk | ru | mixed |
|---|---|---|---|---|---|---|---|
| v3 q8_0 (ships) | 669 | 0.131 | 0.114 | 0.152 | 0.089 | 0.080 | 0.327 |
| v3 q4_k | 416 | 0.120 | 0.113 | 0.129 | 0.099 | 0.042 | 0.294 |
| v3 q4_0 | 356 | 0.122 | 0.097 | 0.152 | 0.065 | 0.132 | 0.277 |
| Ultra q8_0 | 669 | 0.149 | 0.136 | 0.165 | 0.094 | 0.132 | 0.338 |
| Ultra q6_k | 573 | 0.137 | 0.126 | 0.152 | 0.084 | 0.121 | 0.321 |
| Ultra q5_k | 492 | 0.136 | 0.128 | 0.145 | 0.079 | 0.121 | 0.327 |
| Ultra q5_0 | 434 | 0.147 | 0.134 | 0.162 | 0.091 | 0.137 | 0.327 |
| Ultra q4_k | 416 | 0.149 | 0.133 | 0.169 | 0.090 | 0.137 | 0.344 |
| Ultra q4_0 | 356 | 0.110 | 0.101 | 0.121 | 0.014 | 0.164 | 0.321 |

Everything is within a word or two per take, and the models mostly make
the same mistakes ("Поругалась братом из ерунды" from all of them). No
cliff at four bits, again (§1c). Ultra shows none of its FLEURS gain here:
its Russian loses one word every time ("экзаменно" for "экзамен на"),
and its Ukrainian is level. Synthetic speech cannot settle Ultra against
v3; real voices have to, read by every model from the same audio.

The files, the converter (`tools/convert_ultra.py`), the takes and the
whisper.cpp build are in the session scratchpad `shrink/`, which is
temporary.

**The owner's own voice, 2026-11-11 evening** — seven takes recorded in
the simulator (6.7-23 s, Ukrainian, Russian, mixed), every model reading
the same audio with `parakeet-cli`. The current v3 q8_0 lost the second
half of a fast Russian take, dropped a closing "Довольна" and wrote
"Отак" for "А так" and "на читалася" for "начиталася"; every Ultra file
heard all of those, Ultra q4_0 with the most sensible punctuation. v3
q4_0 dropped whole phrases three times ("пасаж. Пасаж", the first half of
the Russian take, "Якось страшно за майбутнє"); v3 q4_k sat level with
q8_0, misses included. Ultra's quirks: numbers as digits ("10, 11" for
"десятий, одинадцятий") and sentences joined with commas. **Ultra q4_0
(356 MB) was the best reader of the six on real speech**, and the owner
put it into the simulator app to live with (copied over the bundled
q8_0 file, same name).

Speed: Ultra and v3 run alike; on the Mac's CPU (`-ng -t 4`, three takes,
52 s of audio) q4_0 took 1.96 s against 2.79 s for q8_0. In the simulator
Ultra q4_0 read at ~0.19 s per second of audio against ~0.10 for q8_0, but
that app is a Debug native build from 2026-09-27 (pods compiled without
optimisation), so only a Release build on a phone can say what the wait
will be.

**In the build since 1.10 (55), by the owner's word the same evening.**
`SPEECH_MODEL` is `PARAKEET_ULTRA_Q4_0`; app.json hands the plugin
`ggml-parakeet-ultra-0.6b-q4_0.bin`; the Xcode resource reference was
renamed in place (seven mentions on four lines). Nobody hosts our
conversion, so `scripts/fetch-model.sh` now makes the file from pinned
inputs — v3 q8_0 at ggml-org rev 35156454 as the template, Ultra's
safetensors and tokenizer at rev 73175eb7 — with
`scripts/convert-parakeet-ultra.py` (numpy, safetensors) and whisper.cpp
v1.9.1's `parakeet-quantize` (PARAKEET_QUANTIZE), and refuses a result
that is not the shipped file (sha256 e7d2561b…d49f, 355,615,679 bytes);
run end to end once and it reproduced it. The terms (§1) now credit
Moondream and NVIDIA under CC BY 4.0, which v3 already called for. The
archive carries only the Ultra file and the app is 382 MB on disk, down
from 681.
Uploaded 2026-11-11 18:30 ("Upload succeeded", app and widget 1.10 (55)),
for the owner to try on the phone from TestFlight: the wait after the
stop and the words, before anything is submitted.

---

## 1d‴. Our own transcriber on the proxy — begun 2026-11-11

The owner's word after §1d″ (2026-11-10): send the take to a server of our
own that keeps nothing and transcribes it there, and bring that server up on
Cloudflare Containers with Parakeet Ultra. What it buys: the 669 MB model
leaves the app (about 45 MB installed) and the full model runs. What it
costs is in the answer given before building it: the onboarding promise
that the voice never leaves the phone, offline transcription, and a wait
that depends on the connection. **The app does not use it yet.** Moving the
app is a separate step, with the privacy copy rewritten first.

**Built (server/):** `transcriber/` is a linux/amd64 image with the int8
ONNX files of Masterx/parakeet-tdt-0.6b-ultra-onnx (istupakov's onnx-asr
graphs of Parakeet v3 carrying Ultra's weights, mapping validated to 1.3e-7;
CC-BY-4.0) at a pinned commit and sha256, `onnx-asr` 0.12.0, onnxruntime
1.31.1 with telemetry off, and a standard-library HTTP server that reads
WAV in memory and logs nothing. The worker gained `POST /v1/transcribe`
behind the same App Attest token and rate limit as `/v1/messages`, a
`Transcriber` Container class (`standard-3`, ten minutes' sleep, no
internet) and a probe header that works only while the
`TRANSCRIBE_PROBE_KEY` secret exists. `@cloudflare/containers` 0.3.7 and
`@cloudflare/workers-types` (dev) were added to server/package.json;
Colima, the Docker CLI and buildx to the owner's Mac (owner's choice).

**Measured locally** on synthetic speech (macOS voices Lesya and Milena),
under Rosetta on two cores: Ukrainian, Russian and a mixed sentence came
back almost word for word ("бог завал" for "був завал" the one slip, and
"честно говоря" spelled in Ukrainian letters). 1.6 GiB of memory. Speed is
not representative there (no AVX): 13.5 s of speech in 7.9 s, 54 s in 51 s.

**Deployed 2026-11-11.** The first deploy put worker 877f4cce live with
the route and the binding (old routes checked) but no container: Containers
need **Workers Paid**, which the owner took the same day. The image then
failed to upload three times (broken pipe on the big layers, after 21 to
137 s), so the encoder now ships in six ~110 MB layers joined at start, and
Colima pushes two layers at a time; the next deploy went through first try:
worker 72c57766, container application `vidlun-proxy-transcriber`
(a036ec28). Setting the probe secret from this session was refused by the
harness (secrets are the owner's), so `server/scripts/probe-transcriber.sh`
does the whole check in the owner's terminal: a throwaway key, each take
cold then warm, the secret deleted on exit, the printout also saved to
`$TMPDIR/vidlun-probe-results.txt`.

**Measured on Cloudflare** (owner's run, 2026-11-11 16:19, instance in
cph01, standard-3, already warm from a run six minutes before — so no cold
start in these numbers):

| take | speech | in the model | end to end |
|---|---|---|---|
| Ukrainian | 13.5 s | 1.13-1.26 s | 1.9-2.2 s |
| Russian | 6.6 s | 0.57 s | 0.9-1.0 s |
| mixed | 8.6 s | 0.69 s | 1.1-1.3 s |
| Ukrainian ×4 | 54.1 s | 4.7-4.8 s | 5.7-5.8 s |

About 0.09 s of model time per second of speech, plus 0.3-0.9 s of
upload and network from Ukraine. Words as on the Mac ("бог" for "був"
again, a synthetic voice's "був"). So a typical 20 s take would wait about
2.5 s after the stop, inside M4's budget, but the wait grows with the take,
which §2's "transcribe while the person is still speaking" was written to
stop: to keep it flat, send the take in pieces while it is being spoken.
Not measured yet: a true cold start (after more than ten minutes idle), and
real voices.

**Taken out again the same evening (owner's word, 2026-11-11): recognition
stays on the phone, the texts are as they were, and the next step was a
smaller on-device model instead (§1d⁗).** Everything below — the client,
the notice, the copy — was removed from the app before any commit. The
server side was committed (e039768) and then **removed the same night, by
the owner's word**: the proxy redeployed without the route or the binding
(version ed99cc05, with a v2 migration deleting the `Transcriber` class),
the container application `vidlun-proxy-transcriber` and its image
deleted, `/v1/transcribe` answering 404. Workers Paid, taken only for
Containers, is the owner's to keep or drop in the dashboard. What was
built and measured is kept here as the record, and in git.

**The app sends its takes there, in pieces — built 2026-11-11, not shipped.**
The owner's word the same evening: send the take in pieces while it is
being recorded, and switch the app's transcription to the server.
`ServerTranscriptionService` is told by the recorder where the take's file
is the moment recording starts (`LiveTakeListener`), and looks at the
growing WAV every second (expo-file-system's `FileHandle`, which asks the
disk for the size each time). Once 12 s are waiting it cuts them at the
quietest 120 ms between 6 s and the newest 0.3 s (never past 20 s), wraps
the slice in a WAV header and sends it to `/v1/transcribe`; pieces go one
at a time, in order. At the stop it reads the true size from the header
and sends what is left, so the wait after the stop is one piece's, at most
about 13 s of speech (~1.5-2 s warm), however long the take. A take
nobody followed live (one parked across a relaunch) goes whole, in one
request. A piece that failed is tried once more at the stop; if it fails
again, `FallbackTranscriptionService` hands the whole take to the model on
the phone, which is still bundled for exactly that. When a take starts,
half a second of silence is sent to wake a sleeping container while the
person talks. A cancelled take aborts its request in flight.

`SPEECH_ON_SERVER` in src/di/container.ts switches it; it is on, and **no
build goes to the store with it on until the onboarding and privacy copy
stop saying the voice never leaves the phone** (CLAUDE.md §2). In the
simulator, where App Attest does not run, the app reaches the transcriber
with the probe key: `server/scripts/simulator-transcriber.sh open` (the
owner's to run) sets a throwaway secret and writes it to
.env.development.local, which only a development bundle reads, and
`close` deletes both. Android records m4a, which this does not read, so
there it falls back to the phone.

**First real take through it — 2026-11-11 16:5x, simulator, owner's voice.**
41.2 s of speech. Wake-up answered in 572 ms (the container was already
warm, so still no cold start measured). Four pieces went while the owner
was talking — 9.8, 9.6, 6.2 and 6.5 s, each read in 0.8-1.1 s — and the
9.1 s tail after the stop took 1.28 s. **Stop to transcript: 1.28 s** for a
41 s take, against about 4.5 s for the same take sent whole (the 54 s
measurement above) and 3.3 s for a 32 s take on the phone's model in the
simulator. The wait is now the last piece's, as §2 asks.

**The copy says so — 2026-11-11, by the owner's word.** The onboarding's
privacy line now says the audio goes to Vidlun's server, which only turns it
into text and keeps nothing (checked on the SE at the largest
non-accessibility text: it fits). The privacy policy gained §2.1 (the audio,
for speech recognition: in pieces, Cloudflare-hosted, nothing written,
on-device fallback) and lost "we physically cannot read them"; the old
§2.1-2.4 are §2.2-2.5. The support page's "Where does my voice go?" was
rewritten (and its "a year" is now thirteen months). In-app legal JSON and
legal/site rebuilt; **nothing deployed**. Still to do before a build ships
with `SPEECH_ON_SERVER` on: the policy's §8 promises to say so inside the app
before such a change takes effect, and the onboarding reaches only new
people, so existing ones need a notice; the policy's effective date; the
landing page (site/src/copy.json still says the audio never leaves the
phone, and its store keywords say on-device recognition); the design file's
privacy line.

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

## 1g. Gemini removed — 2026-08-28, the same day it landed

Built, measured on the desktop and on the phone, and taken out again. The code
is in the history; what follows is why it is not in the app.

**It is twice as slow, and the cost is fixed.** Three takes on the phone: 4069
ms for 35.6 s of audio, 4224 for 24.8 s, 4245 for 20.2 s. The time does not
follow the length — it falls slightly — so it is service latency, not upload,
and compressing the audio would buy nothing. Parakeet is ~2.1 s, also fixed.
Stop-to-card was 4.0 s and would have been near 6.

**It is more accurate on average and worse where it counts.** Over the 15
labelled takes all three engines finished, Gemini took the mean on every
language, and Parakeet was exactly right on 5 of 15 against Gemini's 2. Then
take-02, two words and badly recorded:

```
said       Приготував вечерю.
whisper    Прогутового вечера.
parakeet   Правут о вечерню.
gemini     Доброго вечора.
```

The local two produced visible nonsense. The cloud produced an ordinary evening
greeting nobody said. **Nothing downstream can catch that** — not the analyzer,
not the person reading their own entry back a month later. The better
recogniser fails in the one way this product cannot tolerate, and the mean does
not show it.

**It reopened a promise we had already made.** Onboarding says the voice never
leaves the phone. That line came out when the cloud went in and nothing honest
was ready to replace it; it goes back now, unchanged and true.

**What stays:**

- `scripts/transcription-benchmark.mjs`, minus its cloud engine. It answered
  §1d and will answer the next version of the question.
- The `heard:` / `repaired:` diagnostics, which is how §1f was found at all.
- The whole of §1e and §1f above. The Parakeet numbers, the fluency finding and
  the repair-licence bug are all worth more than the code that produced them.

**What we know now that we did not this morning:** cloud speech-to-text is not
rejected on cost — that objection is dead and should not be repeated. It is
rejected because it is slower, because it ends offline use, and because a
fluent wrong sentence is worse for this product than an obviously broken one.
If the question comes back, it comes back against those three.

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

**Thirteen months since 2026-09-07.** The owner chose the simplest of three
options so that the yearly echo (design round 4) can play the voice on its
anniversary: `ForgetOldRecordings` now cuts at thirteen calendar months, the
onboarding, profile and privacy copy say so, and the sweep test moved with it.

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
| 3b.3 | **Two card states in `useCaptureFlow`**: question, then comparison. | **Done.** `turn` and `comparing`, with the analysis landing behind the question and the comparison built the moment it is answered. |
| 3b.4 | **Nothing of the answer may leak before it is given.** | **Done.** Two guards, because one is not enough: `TurnScreen` is handed the transcript, the chosen words and `holding` and has no way to render the rest, and `whenAnalysisLands` is now a pure function with a test asserting that an arriving analysis changes nothing the person can see. The stage does carry the draft — that is what makes the comparison instant — so what the card knows and what it can show are deliberately two different sets. |
| 3b.5 | **Four difference cases**, including "Vidlun missed what you named". | **Done, and there are five.** `differenceBetween` also tells the two silences apart: the person alone saying nothing, and neither side finding a word. Copy is in the locale files. |
| 3b.6 | **Disagreement is logged separately from a revision.** | **Done.** `DisagreementRecord` under its own storage prefix, written by `ConfirmEntry` only when the refusal was said out loud, never inferred from an absence of taps. Both kinds go when the entry does. The flag also had to be cleared per card — left standing it would have filed the last entry's refusal against this one. |
| 3b.7 | **`distress` and `crisis` skip the question.** | **Done as far as it can be, which is not all the way.** They skip the comparison, not the question: the flag is not known until the analysis returns and the question is on screen before that. One quiet question with a way out of it is the mildest version of asking, and this is the part of the rule the flow cannot honour. |
| 3b.8 | **The settings switch.** | **Done.** `asksFirst`, defaulting on, and off takes the `turn` stage out of the path entirely rather than hiding it. A record written before the switch existed reads as on: a missing flag is not an answer. |
| 3b.11 | **The picker has to reach depth 3.** | **Done.** A chosen word with children offers them under a quiet "точніше?" line; the child replaces the parent in place rather than spending a second slot. A second tap on the same chip lets the word go, so nothing that was possible before became unreachable. |
| 3b.9 | **Re-measure the wait to the question**, not to the card. | **Done, and better than the estimate: 827 ms.** See below. |
| 3b.10 | **Prototype.** `guess` and `reveal` already exist in `design/vidlun-prototype.html` for the old M6 flow. Drop the "1 / 3" counter, which has no meaning during capture, and bring the question to the display size — it is drawn at 19px, which is off the scale. | design/ |

**Measured on the phone, 2026-08-28.** 18.4 s of audio:

```
open model      822 ms
transcribe      827 ms   <- the wait to the question
analyze        1875 ms   <- lands behind it
```

**M4 is met with room, and both ways.** The question is on screen at 0.8 s; with
`asksFirst` switched off the whole card arrives at about 2.7 s, still inside the
two to three seconds §M4 asks for. The old 4.0 s figure was transcription plus
Haiku in series, and the question does not wait for the second half.

The estimate said 2.1 s and it was wrong for a reason worth writing down: every
Parakeet timing taken earlier today — 1985, 1889, 2075 ms — was measured through
`CloudFirstTranscriptionService`, so each one carried a failed round trip to
Gemini before falling back. **What looked like Parakeet's cost was mostly the
cloud's.** With the cloud gone the same wrapper reports 827 ms, and 916 ms on a
short take, which puts BACKLOG 1.7's confidence bands on a recogniser that is
faster than the one they were guessed for.

On the same take the transcript and the repaired sentence were byte for byte
identical — the withdrawn licence (§1f) behaving on live audio, hesitation and
all left standing.

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
| 3c.1 | The week: chart, entry count, narrative, lock. | **Done.** Chart at the drawing's 156 with tappable bars into the journal, the count with a declined noun, the narrative in the dark panel with the first paragraph free. |
| 3c.2 | Week navigation. | **Done.** Both steps stay in place greyed rather than disappearing; back is asked rather than assumed — the week before is fetched to see whether it holds anything. |
| 3c.3 | Theme counts over `contextTags`. | **Done.** `GetWeekThemes`, counted per entry rather than per mention, ring and legend, free. |
| 3c.4 | The entitlement check and the locked state. | **Half done, and the half that exists is the free week.** `Settings.trialStartedAt` plus `isTrialLive`, started by the button the copy already promised. The purchase after it is still M5's and needs a store SDK, which is a dependency to ask about. Until then a spent trial simply stops being offered. |
| 3c.5 | Patterns. | **Done, and not with a model.** The pattern the drawing shows is a difference of two averages, so `FindMoodPatterns` computes it: a tag needs three entries on each side and half a point of gap. A model asked for the same sentence would sometimes produce one the data does not support, and §5 says one fabricated insight costs every later one. Patterns arithmetic cannot reach are still open. |
| 3c.6 | The vocabulary half. | **Done**, on its own screen as the drawing has it. Read from `selfEmotionIds` alone, so it measures the person's vocabulary and not ours. Pairs are found month by month against everything before each month — comparing the whole period against what preceded it went blank on exactly the periods people pick. The period picker, presets and calendar are built. |
| 3c.8 | **What the drawing does not say and the code had to.** The pattern sentence is fixed prose about a walk, so its template is ours. "N more patterns" is counted over the month here because the patterns are monthly, while the drawing's line says week. The picker's "точніше?" line has no copy. All three are provisional until they land in `Vidlun.dc.html`. | design/ |
| 3c.9 | **The chart and the mood picker disagreed at 2.** | **Settled 2026-08-29 on the drawing's split**, and the words settled it: `mood.2` is "low" and `mood.3` is "even", so colouring them alike said something the label denied. The palette already held the drawing's three colours exactly, in both themes; only the split differed. `toneFor` is now the single rule and the chart's private copy is gone. |
| 3c.7 | Prototype. | Superseded: `Vidlun.dc.html` is the drawing and it already carries all of this. What it still owes the code is listed in 3c.8. |

---

## 3d. The rest of the drawing — built 2026-08-28

`Vidlun.dc.html` had fifteen screens and the code had seven. It now has
fourteen; only the grounding exercise (§M8, post-MVP and waiting on a concierge
test) is left undrawn in code.

| Screen | State |
|---|---|
| feed | **Done.** Flat, newest first, not grouped by day — days with nothing in them are not headings with nothing under them. `HistoryScreen` is the file; the name is now wrong. |
| search | **Done.** A word or a feeling, because people remember an entry either way. Searches `cleanTranscript` and the tags, never `rawTranscript`: a card returned on a word the person cannot see would be the app claiming they said it. Filters are their five most-used words, not a fixed list. |
| profile | **Done**, and it replaces the settings screen. |
| palette | **Not to be built.** Decided 2026-08-28: the screen exists in the drawing as a reference for the emotion colour system, not as a place anyone navigates to. The rules it documents are already enforced in `emotionColor.ts` and by the test that keeps every emotion out of the signal range. Do not reopen this. |
| ground | §M8, and §8 asks for a concierge test before any of it is built. |

**What the profile cost.** The drawing's appearance control is a single dark
switch whose off state reads "follows system", so **"light always" has no way
in any more** — §7.6 argues for three states and the drawing has two. Someone
who already chose light keeps it and cannot choose it again. Unresolved.

**The reminder is stored and delivered by nothing.** Hour, minute and on/off
live in settings; scheduling needs `expo-notifications`, which is a dependency
to ask about. The wheel is the alarm-clock one, at the owner's request.

**One block is in the code and not in the drawing**: the switch for whether the
card asks first. §M6 calls that question the point of the product, so where it
is turned off belongs somewhere a person would look. It needs a block in
`Vidlun.dc.html`.

---

## 3e. Mood may be absent — 2026-08-28

`MoodEntry.mood` is `MoodScore | null`, and this was the owner's call after
noticing an entry that said "just recording, no emotions, just sound" had been
filed as a 3 out of 5.

**A three was standing in for "it did not come up".** The analyzer had to
return a number, so on an entry that never said how the day was it returned the
middle one — and that number was then averaged into the week's chart, compared
across the month by `FindMoodPatterns`, and shown on the card as a measurement.
§6 already says zero emotions is a complete entry; the same is true of the
number, and the drawing half-knew it — the comparison card hides the mood block
whenever Vidlun heard no emotion.

Null now travels the whole way: the schema accepts it, the prompt says when
(a three is for a day conveyed as even, never for one nobody described), the
averages skip it, the screens draw nothing, and the editor opens on an empty
scale rather than a pre-filled three. Records written before the change all
carry a number, so nothing old changed meaning.

**What this does not fix**: entries already saved keep the three they were
given. Backfilling would mean guessing again, at a distance, which is the same
mistake later.

---

## 3f. The paid half — built 2026-08-28

§M5 sells one thing and §3c.4 had it as a stub. It is now end to end, minus
the two things that are not code.

**The boundary, as it ships.** The chart, the themes, the journal, search, the
vocabulary and the period picker are free and always will be. The narrative's
first paragraph is free; the rest and the pattern card are not. That first
paragraph is not generosity — locking the whole of someone's own week is the
app holding their words hostage, and the drawing says so too.

**Entitlement has four states, not two.** `none`, `trial`, `trialSpent`,
`subscribed`. `trialSpent` is deliberately distinct from `none`: the offer
changes from "seven days free" to "charged right away", and promising a week
that is gone is a promise the store then breaks. A purchase outranks a running
trial, so nobody who bought is told their week is running out.

**`IPurchases`, and three adapters behind it.** `RevenueCatPurchases` is the
real one; Apple requires in-app purchase for anything consumed in the app, so
the money goes through Apple whatever we use, and RevenueCat is here for the
one thing §2 rules out doing ourselves — validating the receipt without a
server. `UnavailablePurchases` fails honestly when no key is configured, and
refuses to grant anything: a stub that granted entitlement would put people
behind a paywall they never paid for and take it away silently later.
`FakePurchases` is the opposite and says so — development only, behind its own
flag *and* `__DEV__`, because a declined card and a restore that finds nothing
are drawn states no real store produces on request.

**Hutko and the like cannot be used for this.** Guideline 3.1.1: digital
content consumed inside the app goes through IAP. An external acquirer would
be legitimate only for a web subscription bought outside the app, which needs
accounts, a site and a different product.

**The narrative is cached by week.** One row per week, keyed on Monday and
fingerprinted by what the week held, so an entry added or corrected rewrites it
and nothing else does. Without this, every visit to the insights screen was a
Sonnet call — including for people who had paid for nothing, since the first
paragraph is free.

**A week with no pattern says so**, to everyone, paid or not. Absence is a fact
about the week; an empty space where the card was last week reads as something
broken. This came from the owner noticing exactly that.

| # | Left to do | Where |
|---|---|---|
| 3f.1 | **Terms and Privacy are plain text, not links.** App Store review requires working ones, and the pages do not exist. Blocks release. | ours |
| 3f.2 | A subscription in App Store Connect, an `appl_` key, and the entitlement `narrative` with its product in the current offering. The Test Store key proves the path, not the product. | owner |
| 3f.3 | **A store with nothing to sell reports `failed`**, so a missing offering reads as a declined card. True but unhelpful; the drawing has no state for it. | design/ |
| 3f.4 | `FakePurchases` keeps its state in memory, so relaunching loses a scripted purchase. Use `active` to start subscribed. Not worth persisting a dev stub. | — |
| 3f.5 | **Patterns are nearly unreachable on a young journal**: three entries carrying a tag, three without, half a point apart — and an absent mood now shrinks the pool further. Correct per §5, but the paid half stays invisible for weeks. Measure on a real month before touching the thresholds. | §5 |

---

## 3g. The key stopped shipping in the bundle — 2026-08-28

`config.ts` had carried a KNOWN DEBT note since M3: the Anthropic key is
inlined at build time, so it ships inside the app and can be read out of it,
and a key read out of it spends the owner's money. The note said the fix was a
thin proxy. This is it.

`server/` is a Cloudflare Worker on the free tier. The app's Anthropic client
gets a `baseURL` and a token in place of the key, and because the SDK sends its
key as `x-api-key` either way, the Worker reads the app's token out of that
same header and swaps in the real one. **The change on the app side is a base
URL and nothing else** — exactly what the old note predicted.

It refuses what it has no business forwarding: any model other than the two the
app asks for, any `max_tokens` past a ceiling, any path but `/v1/messages`, and
anything without the app token. Answers come back untouched, so the app still
reads an Anthropic error as an Anthropic error.

**What it does not solve, and the note in `server/README.md` says so out
loud.** `APP_TOKEN` ships in the bundle in exactly the way the Anthropic key
did. What it buys: extracting it costs a rate-limited quota rather than an
uncapped bill, and rotating it is a Worker secret rather than an App Store
release. The real fix is App Attest — iOS can prove a request comes from a
genuine build — and it is the next thing to do here. The per-device bucket
keys off an install id the caller controls, so it slows a stranger down and
does not stop one.

**Not deployed.** It needs `wrangler login`, two secrets and a `deploy`, all of
which are the owner's account. Until `EXPO_PUBLIC_API_PROXY_URL` is set the app
talks to Anthropic directly with its own key, which is the shape of a
development machine and is the thing this exists to stop in a published one.

§2 said no backend in the MVP and now says why this is not one.

---

## 3h. The diagnostics came out — 2026-08-29

Everything added to debug the last three days is gone. What it bought is
recorded in §1e, §1f and §3f; what it cost was that the app printed people's
own sentences into a terminal.

Removed: the `heard:` and `repaired:` pair, which is how §1f was found at all
and which had no business surviving the finding; the store's answers; the
week's entry, theme and pattern counts; the entitlement line; and the
development row that reset the trial week.

**Kept: the stage timings.** They carry no transcript and no entry — a stage
name and a number — and §M4 is defined by them. Losing them would mean losing
the ability to say whether the wait is still what the brief asks for.

One `console.log` remains in `src`, in `diagnostics/timed.ts`, behind the
`__DEV__` wiring in the composition root.

---

## 3x. The landing page — built 2026-09-22

The owner asked for a one-page site: how the app works step by step, real
screenshots, the best landing patterns for speed and phones, Ukrainian and
English, light and dark, plain words. It lives with the legal pages, since
that is what vidlun.app already serves: `legal/site/index.html` (uk) and
`legal/site/en.html` (/en), built by `npm run site` from `site/src/copy.json`
and `site/build.mjs`; `site/shots.sh` turns simulator screenshots into
`site/shots/*.avif` (about 9 KB each, ffmpeg's SVT-AV1) with JPEG
fallbacks, and the build copies them and `site/_headers` into `legal/site`,
which is git-ignored and rebuilt before every deploy (`npm run legal` for
the legal pages, `npm run site` for the landing, then the wrangler
command). **Deployed 2026-09-22** at the owner's word — vidlun.app/ and /en answer 200, the AVIF shots with a week's cache — and committed as 7f2a5c1 (the app fixes of §3w stay uncommitted for the next build).

**The page.** Header with the language link and a three-way theme switch
(system, light, dark, remembered in localStorage); hero with the home
screen in a CSS phone frame; four numbered steps — recording, the asking
card with the vocabulary open, the kept entry card, the week — each with
its screenshot; six feature cards; the privacy panel; free against
subscription; four questions; the App Store button again; footer to the
legal pages. Static HTML, inline CSS, one small script, no framework; the
fonts from Google (Unbounded, IBM Plex Sans), the app's own tokens for both
themes; `<picture>` picks the light or dark screenshot by the system
theme, the switch rewrites the sources' `media`; every image lazy but the
hero's, all with width and height; canonical, hreflang, Open Graph,
JSON-LD. 22 KB of HTML per language, ~55 KB of images on first view.

**The screenshots.** Seven screens, two languages, two themes, from the
simulator's Release build of this tree, with a journal seeded straight
into AsyncStorage (`manifest.json` under the app's container): sixteen
entries over three weeks with moods, both emotion sets and echoes, an
event, and a recording file per entry so the card shows the player. The
card that asks for an emotion was reached through the text path with the
sentence pasted from the Mac's pasteboard (`simctl pbsync host`); the
compare card cannot be shown because the analysis never succeeds on the
simulator (App Attest), so step three shows the kept entry instead. The
pass found §3w and the title overlap on the week screen.

Where the drawing is silent: the drawing has no website at all; the
page's look is the app's own language carried over.

**Second pass, the owner's word the same afternoon:** the line about
"under a minute" went (nobody measured it), "one button" went, the asking
step says "pick emotions from the vocabulary or tap I don't know", three
of the six feature cards went (languages, journal and search, reminder /
backup / Face ID), "Privacy by design" became "Privacy", the eyebrow and
"Free. iOS 17 and later" went, "Questions" became "FAQ". And "grey and
dull" became: the lime marker under the headline's key words (the
identity's highlight behind a headline, drawn in on load), a slow marquee
of real vocabulary words in their tones between the hero and the steps
(pauses on hover, wraps still under Reduce Motion), phones tilted a couple
of degrees that straighten on hover, step numerals at display size in the
accent's soft tone, scroll-driven reveals through `animation-timeline:
view()` where the browser has it (plain visible elsewhere), and a drawing
in each feature card — a voice wave that pulses on hover, six chips, a
week of bars — all CSS, no images added.

Third pass, the owner's phone at night: the marker crossed the words and
cream on lime did not read, and the step numerals in the accent's soft
tone vanished on the dark ground. The mark is now a stroke under the words
(top .84em, .24em tall) in both themes, and the numerals have a tone of
their own (`--numeral`: #C9C2F5 on paper, #5A4FA0 in the dark).
Then from the phone again: the glow sat on the hero alone and left the
header a flat band above it, so it moved to the body's top; and the App
Store button broke its label across two lines at a large text size, so
it never wraps and takes the row on narrow screens. Redeployed (a5bf004).

**Favicon and the search pass, 2026-09-22.** The favicon is the app icon
with iOS's corners (`site/icons`: SVG, 32 and 192 PNG, ICO, the 180
apple-touch-icon). A share image per language (`site/og`, 1200 x 630):
composed as SVG with the app's fonts and the home screenshot by
`site/tools/og.py`, rendered through WebKit by `site/tools/render.swift`
(Quick Look's `qlmanage` scaled the SVG unpredictably). The head now
carries `og:image` with size and alt, the Twitter card tags, `keywords`
per language, `author`, `robots` with `max-image-preview:large`, the App
Store Smart App Banner (`apple-itunes-app`), and the icons; the JSON-LD
names the image, the five screenshots and the author. `robots.txt` and a
`sitemap.xml` with hreflang pairs for the eight pages are written by the
build. Left to the owner: verify vidlun.app in Google Search Console and
Bing Webmaster Tools and submit the sitemap — that needs the account.

**The plans on the page, 2026-09-23.** The owner's word: the subscription
card in "what is free and what is not" now carries the three plans with
their prices, read from App Store Connect through the API (subscription
prices and the lifetime price schedule): the Ukrainian page shows the
Ukrainian storefront in dollars (VAT in — $4.99 a month, $29.99 a year,
$99.99 once), the English page the US storefront ($3.99 / $24.99 /
$79.99); the year carries the one-week free trial as a lime badge and is
drawn as the pick. The note under them says where the price is final and
that a subscription renews until cancelled.

**One block, 2026-09-23.** The owner's word: the two pricing cards
("free forever" and "subscription") are one card now — the two lists
side by side, split by a hairline, the three plans across the full width
under them, the note last. On phones the columns stack and the plans
follow the subscription list. The free list has calm-green bullets, the
subscription list accent bullets; the plans sit on the canvas tone inside
the paper card, the year keeps its ink border and lime badge.

**Sharper screenshots, a sticky header, a louder privacy panel,
2026-09-23.** The owner's word, four asks at once. (1) The screenshots
were blurry because `sips -Z 640` had fitted the *height* to 640, so every
phone on the page was a 294-px image stretched to 320 css px; shots.sh now
resamples by width to 640 and 960 px (AVIF, crf 16) plus a 640-px JPEG
fallback, and `shot()` serves them as a 1x/1.5x srcset. (2) The header is
sticky: full-bleed, translucent canvas with a backdrop blur, a hairline
that fades in over the first 120 px of scroll (scroll-driven animation,
plain translucent bar where unsupported); sections carry a scroll margin
so the anchors land under it. On phones the theme switch shows icons
(system, sun, moon) instead of words so the bar stays one row; the section
links hide below 900 px. (3) The privacy panel: the title at hero size
with the lime underline, the body split into its three sentences as three
statements in Unbounded under lime line icons, a lime glow in the corner;
the policy link left the panel (the footer keeps it). (4) The note under
the plans is 13 px and free of the 62ch paragraph cap, so one line on
desktop.

**The hero and the steps, 2026-09-23.** The owner's word: the hero's lead
paragraph is gone (key `hero.lead` removed), the two actions stack, and
"how it works" is an outlined pill with a bobbing arrow instead of an
underlined link. The steps come in part by part as they scroll into view:
the numeral pops up from small, the title and text rise, the phone rises
from lower and slightly smaller — scroll-driven `view()` timelines with
`cover` ranges for the text so the reveal lasts a real distance; the step
as a whole no longer fades. Reduced motion turns all of it off.

**The page for 1.3, 2026-10-07.** The owner's word ("онови інформацію на
сайті та скріни").
- **Screenshots.** Twenty new ones, in both languages and both themes. They
  were taken at 9:41 from a seeded demo journal:
  - the home screen;
  - recording;
  - the card with the nearest words, two of them chosen and "more
    precisely?" open;
  - the entry page with its recording, topics and echo;
  - the week with a noticed pattern and topics.

  `journal` and `turn` went, since the page never used them.
- **Copy follows 1.3.**
  - Step 2 is the card offering the nearest words: pick one, go more
    precise, or add one's own, with mood and topics on the same card.
  - Step 3 is the entry page ("come back to any entry"), with the echo
    named as the subscription's.
  - Step 4 is the week, and the month written for subscribers.
  - The free and paid lists say what 1.3 gives and sells: recording up to
    a minute is free, the week's topics and patterns are paid. The prices
    were read from App Store Connect again and had not changed.
- **A fourth feature.** "Хвилина для себе" is drawn as the exercise's ring
  in the app's calm green.
  - The features grid is four columns from 1080 px, two below that, one on
    phones.
  - The chips drawing keeps the cards' common height, so the titles line
    up.
- **Fingerprinted image URLs.** They carry `?v=` and a fingerprint of
  `site/shots` or `site/og`. Both are cached for a week under fixed names,
  so without it a returning visitor would see last week's screenshots
  beside this week's words.
- **og.py.** It read `<lang>-home-light.jpg`, a name gone since the 640/960
  split, and now reads `-640.jpg`.
- **Hero alt.** The hero image has its own alt (`hero.alt`) instead of the
  first step's.
- **Deployed the same day.** The terms and privacy pages went out with it
  and finally say month; the repo had said so since e0b6395.

---

## 3ψψψ++++++++++++++++++++++++++++++++++++++++++. The review's memory, privacy and battery fixes — 2026-11-26

Owner's word: "роби інші правки по плану" (steps 2–4 of the review's plan,
the ones that need no product decision).

- **Memory.** One speech service for the app's life, the language read
  through a ref: it was rebuilt, with the whole container, for every
  language — at launch on any non-Ukrainian phone — which loaded a second
  model the first never let go and ran every background job twice. The
  model is released when the app goes to the background or memory runs
  short (`ITranscriptionService.release`, waiting for a transcription under
  way). Backup and restore read their chunks in autorelease pools (303 MB
  peak for 300 MB of voice, 3 MB with them). The entry cache survives
  writes and shares one read among concurrent callers.
- **Privacy.** The month's narrative cache keeps a hash of the month, not
  its transcripts; old rows are hashed when they match, weekly rows swept,
  and deleting an entry forgets its month's narrative (`INarrativeMemory`).
  Restored entry ids must be `[A-Za-z0-9_-]`. The relock counts the steady
  clock too, so setting the time back does not open the journal. Sheets
  hide under the lock door and are covered while the app is out of front
  (`Cover`). A release build refuses the direct Anthropic key. A late
  analysis no longer brings back an entry deleted while it ran.
  `server/.wrangler/` is ignored and untracked.
- **Battery.** The return work (late analyses, voice measuring, home)
  runs only after a real return from the background, not after Face ID or
  Control Center. Home under another screen stops its rings and the
  year-ago voice; the rings run natively with their delay once (the second
  one used to drift to a 5.1 s lap). The recorder stops polling while a
  take is paused and gives the session back to playing after every take.
  A second record tap while one is starting is ignored. Backup and voice
  work run on their own utility queues, off the one the recorder prepares
  on. Voice analysis decodes at most six minutes. Speech spans are
  remembered per recording; an unreadable recording is left out until the
  next launch; ◀◀ ▶▶ leave the lock screen with the module.
- **Speed.** The flow's dependencies and `today` are stable between
  renders; search keeps each transcript's folded words; the token and the
  connection to the proxy are readied at the record tap; home reloads
  after a restore; RevenueCat's web store (870 KB) is left out of the
  phone bundle.
- Still open, needing the owner's word: `vidlun://record` starting a take
  from any app, the privacy policy's line on App Attest.

---

## 3ψψψ+++++++++++++++++++++++++++++++++++++++++. The proxy serves only the app, a day at a time; the card stops waiting — 2026-11-26

Owner's word after the security and performance review: "починай з першого
пункту".

- **The proxy rebuilt what it forwards** (`server/src/requestShape.ts`). It
  used to check the model and `max_tokens` and pass the rest on, so a token
  read off one's own phone opened the key to any prompt, tools and long
  conversations, at 30 calls a minute with no daily end. Now the body is
  rebuilt from the two shapes every version since 1.0 sends — a reflection
  on Haiku (at most 2048 tokens back), a month on Sonnet (at most 1024), the
  1.10 echo fits the first — with one user turn of text; any other field is
  refused. Tests feed it the requests the app's own adapters make.
- **A daily allowance per attested key** (`server/src/allowance.ts`, a
  Durable Object per key holding one row): 100 Haiku calls, 30 Sonnet calls
  and 10 feedback notes per UTC day. Feedback subjects lose control
  characters. Needs `wrangler deploy` (migration v3); not deployed yet.
- **The card stops waiting after 8 s** (`withinDeadline`, both the first
  reading and the one after a corrected transcript). A weak network used to
  hold the processing screen for 41–70 s (20 s, a retry, and the daily token
  renewal); past the deadline the card goes on as when offline and Vidlun's
  answer is listened for later.
- Still open: building the prompts on the server so the app sends only the
  words (needs an app release that asks for it), checking the subscription on
  the server for the month, and a spend limit on the Anthropic workspace.

---

## 3ψψψ++++++++++++++++++++++++++++++++++++++++. A pause button on the recording screen — 2026-11-26

Owner's word on the canvas page «Пауза в записі», variant A: three buttons
in one row at the bottom, "ліворуч червона кнопка з хрестиком вихід, по
середині кнопка пауза і плей, праворуч кнопка завершення запису"; done pale
green like leave's pale red; "роби в коді варіант А, світлий для світлої
теми".

- **The row** (`RecordingScreen`): «Вийти» on the left, a pale red disc with
  an X, asks «Вийти із запису?» as the corner X did (the X is gone); the
  middle button pauses and goes on («Пауза» / «Продовжити»); «Готово» on the
  right, a pale green disc with a tick, ends the take as the stop button did,
  held or not. Each is named underneath.
- **Held**: the label reads «На паузі», the clock stands and breathes, the
  bars lie down as a flat dotted line, the hint becomes «Продовж, коли
  захочеш.». Going on writes into the same recording (the recorder's own
  pause and resume, already there for calls). The free minute and the paid
  five count only the time spent talking.
- **Calls and leaving the app** hold the take and ask, as before. A take the
  person held themselves is left as it is: coming back to the app asks
  nothing.
- **The room follows the theme**: a paper card with a line round it in the
  light theme, the dark panel at night. In the light room the middle button
  is ink with a lime glyph and the lime bars are darker (`#9DC41A`), because
  lime on paper all but vanishes.
- **Motion**, timed by the design's prototypes: the bars rise from the
  middle out, 22 ms apart, a touch past their height; they sink from the
  ends in over 0.3 s when held, and the flat line comes in after them. A dot
  blinks by «Записую» and a ring leaves the middle button every 2.8 s while
  the take listens. The glyph turns between pause and play, captions and
  hint cross-fade. Under Reduce Motion nothing blinks or travels; the states
  only fade.
- Copy: «На паузі», «Пауза», «Продовжити», «Готово», «Продовж, коли
  захочеш.» (en: Paused, Pause, Resume, Done, "Go on whenever you like.").
  `recording.stop` is gone with the stop button.

---

## 3ψψψ+++++++++++++++++++++++++++++++++++++++. The journal filtered by topic — 2026-11-24

Owner's word on the canvas page «Щоденник: фільтр за темами»: "бери А, і
так, тап по темі відкриває щоденник".

- **One sheet** (`JournalFilterSheet`, was `EmotionFilterSheet`): «Показати
  записи», the emotions this person used, and under them «Теми» — every
  topic their entries had, the most used first (`topicsUsed`), in the
  neutral grey. «Показати» waits for a chip of either kind.
- **How they combine** (`entriesMatching`): any of the chosen emotions, any
  of the chosen topics; with both chosen, an entry needs one of each.
- **Applied**: the chips over the journal, emotions in blue then topics in
  grey, each with its X, and «Скинути» for all. The badge on the filter
  button counts both (`filterSize`). The flow holds a `JournalFilter`
  (`emotionIds`, `topics`) instead of a list of emotions.
- **From an entry's page**: a tap on a topic opens the journal narrowed to
  it (`openTopic`), its search and emotions cleared.
- Copy: «Показати записи», «Фільтр записів», «Таких записів немає.».
- **Two tabs** (owner's word the same day, canvas page «Фільтр: таби
  «Емоції · Теми»», variant B): with many emotions the topics sat out of
  sight at the bottom, so the sheet has «Емоції» and «Теми» as text tabs,
  the open one underlined, each with a round count of its picked words.
  The sheet holds the taller tab's height (both are laid out and measured),
  opens on the topics when only topics are applied, and shows no tabs when
  the journal has only one kind. The words may take up to 70% of the
  screen before they scroll.
- **Topics on the journal's cards** (owner's word the same day, canvas page
  «Щоденник: теми на картці запису», variant C): under the emotions, the
  entry's topics as small grey chips, the shape topics have on the entry's
  page and in the filter (`EntryCard`). A tap on one narrows the journal to
  it (`openTopic`, search and emotions cleared); a tap anywhere else on the
  card opens the entry, as before. Locked cards show no topics, as they
  show no words.

---

## 3ψψψ++++++++++++++++++++++++++++++++++++++. A swipe back that shows where it goes — 2026-11-24

Owner's word: "поглянь на плавність повернення на попередній скрін через
свайп". Three things made it rough: nothing was under the screen being
swiped (the screen behind was not drawn, only the ground), the swiped screen
was put back in place a frame before the next one appeared, and the screen
come back to was built again (the journal back at its top).

- **Kept underneath** (`screenStack.ts`, `CaptureFlowScreen`): the screen a
  swipe or the back button goes to stays mounted under the one on top —
  home, the journal, the statistics, the months and the subscription page,
  the screens that hold nothing playing. A month heard in its own voice and
  the card with its take are left out, so nothing sounds under the page
  above. Only the screen right under the top one is drawn.
- **As on iOS**: covered, it sits 30% to the left under a light scrim and
  moves into place with the finger; the screen on top carries its own
  ground and a soft shadow on its left edge (`Layer`, `SwipeBack`).
- **No flash**: the screen that leaves is no longer put back before it is
  gone; each screen has its own place value, so the one come back to stands
  where it was. The journal keeps its scroll.
- The back button goes back at once, as before; it lands on the same kept
  screen.

---

## 3ψψψ+++++++++++++++++++++++++++++++++++++. The entry page: voice and words in one card — 2026-11-24

Owner's word on the canvas page «Запис: голос і текст у картці» (variant B,
then "голос згорнутий, транскрипція розгорнута, кожен раз за замовчуванням",
the word being said lit as it plays, and a searched word lit in the
transcript).

- **With a voice** (`EntryDetailScreen`): no large sentence at the top. The
  player's card holds the player, «Текст запису» (named «Транскрипція
  запису» until the owner's word the same day) and, under it, the line on
  how the voice sounded. The line's chevron folds the voice's scales out in
  the card (`VoicePortrait`, which was a sheet); the text's chevron folds it
  away. Every entry opens with the text open and the voice folded; nothing
  is remembered between entries.
- **The word being said** is lit in the mood's soft colour as it plays, as
  the played bars are. It is an estimate: nothing records when each word
  was said, so the share of the speech already heard (`shareAt`, the way
  back from search's `momentAt`, pauses skipped) is laid over the
  transcript (`wordAt`). It can run a word or two ahead or behind. The
  player reports its place every 200 ms. The speech spans are read from the
  file when the entry opens (`FindSpokenMoment.speechIn`), stored nowhere.
- **From a search** the transcript is open, the found word lit in the
  accent, and the player stands by it, as before.
- **Without a voice**: the large sentence at the top as before, and the note
  under it now has a struck-through microphone.
- The page waits for the recording lookup (`recordingKnown`) before drawing
  either layout, so a voice entry no longer shows as a typed one first.

---

## 3ψψψ++++++++++++++++++++++++++++++++++++. Choosing together as a sheet — 2026-11-24

Owner's word on the canvas page «Обрати разом» діалогом: "«Обрати разом»
плутає … не окремою сторінкою, а діалог", then the name kept, the button
centred under the words, none when nothing was heard, and "так, бери A".

- **Where it is:** «✦ Обрати разом» in Vidlun's colour, centred under the
  feelings step's words (`CardFeelingsScreen`). It used to be the second
  button under «Обери настрій», where it read as choosing the mood together.
  The step has one button at its foot now.
- **What it opens:** a sheet, not a page (`TogetherSheet`): «✦ Vidlun почув»
  and Vidlun's words, all chosen to start with; a tap takes one off and puts
  it back. «Обрати» puts the ones left chosen into the step's row, after the
  person's own, and the link is gone. ✕ or a tap outside adds nothing. The
  page «Обираємо разом» and its stage (`comparing`) are removed.
- **The unaided answer** (`selfEmotionIds`) is what was named when the sheet
  first opened (`whenTogetherOpened`), since Vidlun's words are in sight from
  then on. A word of Vidlun's left out of the sheet, or the sheet closed with
  nothing taken, counts as declining (`declinedVidlunsWords`).
- **Nothing heard:** when Vidlun heard no clear emotion, or could not listen,
  there is no link at all, and «Обери настрій» goes on without a word (§6:
  no words is an answer). Otherwise it still needs a word, or the sheet seen.
- **Saving** always writes the entry from the card (`cardAfterAnswer`): the
  old way of going on without a word to Vidlun's words is gone with the page.

---

## 3ψψψ+++++++++++++++++++++++++++++++++++. The month heard in its own voice — 2026-11-23

Owner's word "бери місяць голосом" on the canvas page «Місяць голосом»
(the proposal there, open questions settled as advised).

- **Where:** the month page, under the prose (`MonthScreen` →
  `MonthVoicePlayer`). Shown only when an entry of the month kept a voice;
  the month page is already the subscription's, so the player is too. The
  plans list a new line, «Послухати свій місяць голосом» (`subs.perkMonthVoice`).
- **What plays:** every entry of the month with a kept take, first to last
  (`GetMonthVoice`). Typed entries and ones recorded with keeping off have no
  take and are not in it. Hard entries (distress, crisis) are heard like any
  other, and nothing is written under the block (owner's word, 2026-11-23,
  replacing the proposal's leaving them out with a quiet line).
- **Two modes:** «По 10 секунд» (`GLIMPSE_MS`; a take cut short fades out
  over 600 ms) and «Цілком». 700 ms of quiet between takes.
- **One file:** the takes are joined on the phone into one AAC file
  (`ComposeMonthVoice` → `NativeVoiceMontage` → `MonthMontage.swift` in the
  voice module: AVMutableComposition + AVAssetExportSession). One file plays
  on with the screen off without the app waking between takes, and the lock
  screen shows one player. The file lives in the cache folder `month-voice`:
  one at a time, removed when the month page closes, swept at launch
  (`CacheLeftovers`). Nothing leaves the phone.
- **Playing:** «5 з 18», the strip filling take by take, the day and the
  sentence being heard (a tap pauses and opens the entry; back from the
  entry returns to the month), back / pause / on. Back restarts the take
  after 2 s, else goes to the one before. Switching modes while playing
  goes on from the same take.
- **Background:** `UIBackgroundModes: audio` (app.json `enableBackgroundPlayback`
  and ios Info.plist by hand). The month player alone asks for the
  background (`shouldPlayInBackground`, `doNotMix` for the lock screen
  controls) and puts the session back when it leaves. App Review should be
  told why the mode is there (scratchpad review notes).
- **Lock screen and Dynamic Island** (owner's pick of two, variant A, canvas
  «Місяць голосом: заблокований екран і острівець»): iOS draws both; the
  title is the take's day and time («22 жовтня · 22:00»), the subtitle the
  month and how far («Твій жовтень · 5 з 18»), the picture Vidlun's mark on
  its dark ground (`assets/month-voice-artwork.png`, the icon at 600 px).
  Nothing from what was said: anyone near can see a lock screen. ◀◀ ▶▶ go
  between entries, as the page's own buttons do: the voice module registers
  MPRemoteCommandCenter's previous/next track commands while a month plays
  (`listenForTracks`, `setTrackCommands`); expo-audio alone has only ±10 s.
- **Later (owner's call):** a ▶ on home's month card and in «Твої місяці».

## 3ψψψ++++++++++++++++++++++++++++++++++. The card in three steps — 2026-11-23

The owner's word: the card after a recording was one page too full — the
words, their topics, the repair, the question, the words offered, the
mood and two buttons. It is three steps now, drawn on the canvas page
«Картка: фінальний флоу» after a day of drawings (one-page redesigns, two
steps, the mood on a page of its own, six mood screens, four places for
the repair).

- **1 «Твої слова»** (`CardWordsScreen`): for a spoken entry the take to
  play back (`Playback`, inline), then the whole transcript, never
  shortened (owner's word); «✎ Виправити», a small labelled pill beside
  the heading, opens the repair in place (the owner's pick of four: a
  pencil alone was easy to miss, a whole-width button stood a second large
  button over the way on); the topics as before. «Обери емоцію» goes on.
- **2 «Що ти зараз відчуваєш?»** (`CardFeelingsScreen`): one row — the
  nearest words, a chosen one filled where it stands with its cross, a
  word of one's own after them, and «+ Додати емоцію» (the production
  name, owner's word) as a chip typed in place with its tick (`ChipField`,
  shared with the topics). The box of chosen words above the list is gone.
  «Обери настрій» (was «Далі»; named for where it goes, owner's word
  2026-11-23) needs a word, as before; «Обрати разом» opens 2′.
- **2′ «Обираємо разом»** (`CardTogetherScreen`, was `CompareScreen`):
  only emotions — what Vidlun heard, already chosen, and what the person
  named before asking — plus «+ Додати емоцію» (owner's word). No other
  offers, no topics, no mood. «Обери настрій» goes to the mood.
- **3 «Який зараз настрій?»** (`CardMoodScreen`, `MoodList`): the quiet
  list without plates (the owner's pick of six): a dot and a name, highest
  first; Vidlun's mood already chosen, with no mark saying whose it is
  (owner's word); the chosen row takes its soft ground, bold letters and a
  tick. «Зберегти» saves.
- Every step (`CardPage`, `CardHeader`): three bars, «Новий запис · 21:14»,
  the bin that asks; a back arrow from the second step (and the edge
  swipe), keeping everything chosen. The buttons stay at the foot of the
  screen; the content scrolls under them.
- **State** (`useCaptureFlow`): the card's stage carries a `step`
  (`whenStepped`, `whenSteppedBack`); choosing together comes back on the
  mood (`whenChosenTogether`); an entry Vidlun could not hear goes from
  «Обрати разом» to the mood. Saving is unchanged (`whenAnswered`,
  `cardAfterAnswer`), only asked from the mood now.
- **Cost:** two more taps than the one page («Обери емоцію», «Зберегти»).
  CLAUDE.md §9 notes the owner's exception.
- Removed: `TurnScreen`, `CompareScreen`, `OwnWordField`, `FixWording`,
  `EmotionShelf`. `Chip` keeps a chosen word filled when it carries its
  cross.

---

## 3ψψψ+++++++++++++++++++++++++++++++++. A topic Vidlun missed, written in on the card — 2026-11-23

The owner's word: a topic Vidlun got wrong comes off, and one it missed goes
in, after recording and before saving; a saved entry's topics do not change.
Five topics an entry at most. Drawn on the canvas page «Теми запису
(новий)» (the entry-page boards there are marked as not built: the owner
first chose them, then settled on the card the same day).

- **On the card**, in the transcript's box, «Теми» is now always there: the
  chips as before (one of Vidlun's taken off stays faded with «+», to be put
  back), then the person's own, then a dashed «+ Додати тему». A topic of
  one's own is taken away by its cross rather than faded.
- **«+ Додати тему»** opens into a line in place (`CardTopics`, never a
  Modal, which eats taps on iOS 26 with the keyboard up). Nothing is offered
  under it: the person's topics from other entries were, for an hour, and
  the owner took them out. Return adds what is typed, and "next" or "choose
  together" adds a topic still being typed first, as with the own word. The
  keyboard puts in no capital: Vidlun's topics are lower case; a name typed
  with one keeps it. The line is a chip typed in the row where the topic
  will stand, with its own round tick, pale until something is typed (the
  owner's pick of two drawings, canvas «Своя тема: два варіанти поля», A;
  the other was a line over the keyboard).
- **Rules** (`Topic`): five topics, Vidlun's and the person's together
  (`MAX_TOPICS`; Vidlun names three at most), and a faded one is put back
  only while there is room; 30 characters; spaces tidied. Two spellings
  that differ in case or apostrophe are one topic (`topicKey`): typing one
  of Vidlun's taken-off topics puts it back, the card never holds one twice,
  and a topic the journal has goes in with the journal's spelling, so the
  week's themes do not split it (`KnownTopics`, read when the line opens,
  so nothing on the way to the card waits for it).
- **Saved** after Vidlun's (`keptTopics`), into the entry like any topic:
  the week's themes, «Теми й настрій», the month and the backup count them.
  `proposed` keeps what Vidlun heard. An entry Vidlun could not hear keeps
  the person's topics, and Vidlun's join them once it has heard
  (`mergedTopics`, up to five).
- CLAUDE.md §9 keeps optional fields off the way in; the owner made this the
  second exception after the question itself. It adds no wait: the card is
  already up, and nothing is read until the line opens.
- The privacy policy already lists topics among what the month sends.

---

## 3ψψψ++++++++++++++++++++++++++++++++. One backup, to read and to restore — 2026-11-23

The owner's word: the backup and the readable export looked like the same
thing twice, and only one of them could come back. Way A of two (one file
for everything; way B, a second "for reading only" button, was not taken),
drawn on the canvas page «Резервна копія: один файл (новий)»; the row keeps
the name «Резервна копія» (owner's word, 2026-11-23).

- **On «Я»** the card has two rows again: «Резервна копія» with pill
  «Зберегти», and «Відновити з копії», whose line and error are unchanged.
  The backup's line before the first copy is «Усі записи текстом і з
  голосом» ("Every entry as text, with its voice"; the owner cut the rest,
  "to read anywhere or bring back into Vidlun", the same day), then the
  day of the last copy as before. «Експорт для читання» and its
  six strings are gone; "to share with a professional" went with it,
  because the file is the whole journal now (below).
- **The file** is the readable export's ZIP, same name («Vidlun — записи до
  23.11.2026.zip»), same «Щоденник.md» and `audio/`, plus a hidden
  `.vidlun.json` (`backupEnvelope`): the codec's JSON whole and each voice's
  path by entry. The leading dot keeps it out of sight in Files and Finder.
  It is everything the journal holds, the raw transcript, mood, topics, the
  words named before Vidlun's answer and the hard-day flag included, which
  is why the line no longer suggests sending the file to someone.
- **Restoring** (`NativeBackupArchive.open`) takes that ZIP, the Apple
  Archive backups of 1.10 and 1.11, and JSON before them; picking the hidden
  file itself works too, without the voices. What comes back is what the
  hidden file says; edits to the Markdown do not travel. An unpacked folder
  cannot be picked on an iPhone, so the ZIP is what restores.
- **Reading a ZIP** is new native code (`ZipReader.swift`), stored and
  deflated entries, so a backup that a Mac or the Files app packed again
  still opens. Streamed in chunks and checked by size and CRC. Every name is
  checked before anything is written: one that climbs out ("../") or starts
  at the root refuses the whole file, and `__MACOSX` is skipped. A voice
  whose entry id or path could reach outside the backup is dropped. Checked
  on the Mac against our own ZIP, `ditto` and `zip -9` archives, a damaged
  byte, and hostile names.
- `BackUpJournal` now writes the readable journal too (it took in
  `ExportReadableJournal` and its tests); `ExportJournal` became
  `journalMarkdown` (`renderMarkdown`); `IReadableArchive` and
  `NativeReadableArchive` are gone. The cache sweep knows the new
  `backup-out` folder and still sweeps the export's two old ones.
- The privacy policy needs nothing: §5 already says «Резервна копія» hands
  over every entry with its audio in one file, which closes the to-do in
  §3ψψψ++++++++++++++++++++++++++.

---

## 3ψψψ+++++++++++++++++++++++++++++++. The journal's count stays beside its title — 2026-11-20

The owner's word: on a 14 Pro the count and the filter fell under
«Щоденник».

- **Why:** from 100 entries the row needed 360 pt, and a 393 pt phone has
  349 between its margins: the pill's tabular digits, its dot, and a 12 pt
  least gap. A 402 pt phone was 2 pt short of the same.
- **The dot before the number is gone** (owner's word, `CountPill`): it said
  nothing the number did not, and it cost 13 pt.
- **The least gap between the title and the pill is 8 pt**, not 12; spread
  to the edges they stand further apart than that on any phone (about 10 pt
  on a 390 pt one). A three-digit count now fits beside the title on a
  390 pt phone; 1,000 entries or a larger text size still wrap under it,
  rather than clip.
- Checked on the iPhone 17e simulator (390 pt) with 128 entries.

---

## 3ψψψ++++++++++++++++++++++++++++++. Search what was said, and hear it — 2026-11-20

The owner's word (plan item 9), drawn on the canvas page "Пошук по
сказаному": search comes back, not as a tab but as a field in the journal,
and the found word can be heard where it is said (way B: estimated, nothing
stored).

- **The field** «Пошук по записах» sits under the journal's title and scrolls
  with the list (`SearchField`). The list narrows as the words are typed; the
  count pill counts what is found; «Скасувати», there while the field is in
  use, empties it. It survives opening an entry and coming back, and clears
  when the journal is opened from the bar, like the emotion filter, which it
  narrows further.
- **Letters, not meaning** (`SearchQuery`): each typed word finds the words it
  begins, so a Ukrainian stem finds its endings; every typed word must be
  there; case, the three apostrophes and the Russian yo make no difference.
  Words are split on a listed set of spaces and punctuation, not Unicode
  classes, which Hermes may not know.
- **A result card** shows the sentence the word is in, with every found word
  lit in the accent's soft tint (`snippetOf`), three lines at most. A locked
  entry is found like any other and stays locked: date and lock, no words.
  Nothing found: «Нічого не знайшлося» and «Спробуй інше слово або зніми
  фільтр емоції.»
- **The entry opened from a result** lights the words in its sentence and
  stands the player where the word is said, with «Грає з місця, де звучить
  «…»» under it. Where comes from `FindSpokenMoment`: the word's place in the
  raw transcript (the cleaned one if only there), as a share of the text,
  laid over the stretches of the recording where the person speaks; the
  pauses take no share. The player starts `LEAD_IN_MS` (2 s) earlier, never
  before the start. The stretches come from the voice module's new
  `speechSpans` (the measures' own speech test, pauses of 0.26 s or more
  between stretches), read from the file each time; nothing is stored.
- **Why estimated:** whisper.rn hands Parakeet's result over as one segment
  for the whole take (t0 0, t1 the end), although the model times every
  token. Way A — patching the bridge and storing word times — was offered
  and not taken: it would only help new entries and means carrying a patch
  of someone else's library.

---

## 3ψψψ+++++++++++++++++++++++++++++. Face ID, back and free — 2026-11-20

The owner's word, after the competitor plan (item 8): every one of the six
journals compared has a lock, and a kept voice is more intimate than text.
The design canvas page "Face ID" holds the drawings; the door is variant B
with its key enlarged (88 pt, glyph 42).

- **"Me"** has a row between "Зберігати аудіо" and the backup card, named by
  what opens the phone: Face ID, Touch ID or Код-пароль
  (`IScreenLock.readiness`). Off it says «Безпечний вхід» (owner's word, the
  same day, in place of «Щоденник відкривається одразу»; "Secure access" in
  English); on, «Щоденник відкривається через Face ID». The switch turns on only after one
  successful unlock, and a phone with neither biometrics nor a passcode gets
  «Face ID недоступний» and the switch stays off.
- **The door** is the splash's wordmark on the canvas and a round key at the
  bottom («Відкрити через Face ID»). Face ID is asked for by itself a beat
  after the door shows (`ASK_FOR_FACE_AFTER_MS`, 450 ms), never under the
  splash, and asked again only on a real return from the background: the
  prompt itself takes the app to "inactive", and counting that would ask
  again the moment someone cancelled. The passcode stays allowed behind
  Face ID.
- **When it shuts:** at every launch and after more than a minute away
  (`relocksAfter`). The door starts shut instead of following a default that
  has not been read yet, which is how 1.3's lock let a cold launch in.
- **A take from outside goes ahead** (owner's choice B): a widget, Siri, the
  Control Center or the Action Button starts the recording without Face ID,
  and the card shows only what was just said. The door stands again the
  moment the take is saved or let go (`opensWhileLocked`). Anyone holding
  the phone can add to the journal; only its owner can read it.
- **The app switcher** shows the wordmark cover while the lock is on, rather
  than the blur everyone else gets: a blur still shows the shape of the page.
- **Stored as `journalLock`**, not 1.3's `appLock`: a phone that still
  carries the old switch from then must not wake up shut.
- `expo-local-authentication` 57.0.3 is back (the owner's yes, 2026-11-20), and
  `NSFaceIDUsageDescription` with it in app.json.
- **The privacy policy** has its Face ID line again in both languages
  («лише якщо замок щоденника увімкнено в «Я»»), and the in-app copy is
  rebuilt. The site goes out with the release that ships the lock, not before.

---

## 3ψψψ++++++++++++++++++++++++++++. Undo a deletion, five seconds — 2026-11-19

Step 6 of the competitor plan: what is deleted by accident cannot come
back, and people ask for it (Video Diary's reviews; Apple Journal keeps
"Recently Deleted"). Designed first on the canvas's "Скасувати видалення
(новий)" page; the owner asked for a round timer and chose variant B.

- **The question goes, the undo comes** (variant B): the journal's swipe
  button and the entry page's bin delete at once, and a line at the top —
  the notices' own dark panel — says «Запис видалено» with «Скасувати».
  The question ("Видалити цей запис?") was there only because nothing
  could be undone. Holding a row now only opens it to the button, so a
  long press can never delete by itself. The card before saving keeps its
  question: undo there would have to bring the card back.
- **A round timer** on the left of the line (owner's word): a ring that
  thins over five seconds with the seconds counted in its middle; under
  Reduce Motion it steps once a second. Five seconds, a tap on the line or
  another deletion make it final (`UndoToast`).
- **Nothing is held in storage.** "A journal that quietly holds onto what
  you deleted is worse than one that loses it" stays true: `DeleteEntry`
  now removes the entry, its revisions and disagreements, and its voice
  measurements at once, keeping them only in memory, and moves the voice
  to `Caches/held-voices/` (`IRecordingStore.setAside` / `release`). Undo
  writes it all back (`IRevisionLog.recordsOf` reads the records first);
  settling lets the voice go. Closing the app in between is as final as
  the five seconds: the cache folder is swept at the next launch
  (`CacheLeftovers`).
- Copy: `undo.deleted`, `undo.action`, `undo.left` (the ring's spoken
  label). Tests: four new for `DeleteEntry`, one for `recordsOf`.
- **The swipe's button is smaller** (owner's word, the same evening): the
  entry page's own red bin glyph on the canvas, 44 pt to tap, instead of a
  red block the height of the row.

---

## 3ψψψ+++++++++++++++++++++++++++. The day of the last backup — 2026-11-19

Step 5 of the competitor plan: Daylio's worst reviews are about lost voice
recordings, from people who never knew when their last copy was. Designed
first, on the canvas's "Дата копії (новий)" page; the owner chose variant A
and kept the iCloud line.

- **The backup row's line becomes the day** once a backup has been handed
  over: «Остання копія: 12 листопада.» ("Last backup: November 12."),
  «сьогодні» / «вчора» for the last two days, the year only when it is not
  this one (`backupWhen`, added by hand in Ukrainian so the line does not
  end in "р.."). Before the first backup the line is as it was. Same grey
  however long ago: no reminder, no colour, nothing that reads as a
  reproach. Variant B ("Відтоді 5 нових записів") was not taken.
- **Only a backup the share sheet handed over counts**
  (`Share.sharedAction`); a sheet closed without sharing leaves the day as
  it was. `IBackupLedger` / `AsyncStorageBackupLedger`, key
  `vidlun.lastBackup`, an ISO string.
- **Under the data card, one quiet line** (`Section`'s new `footer`):
  «Якщо на iPhone увімкнено резервне копіювання iCloud, записи й аудіо
  також потрапляють у копію телефона.» — what the privacy policy's §4
  already says.
- 8 tests (`backupWhen`, the ledger).

---

## 3ψψψ++++++++++++++++++++++++++. The readable export, with the voice — 2026-11-19

Step 4 of the competitor plan (`reports/`, not committed): the competitors
that let people take their journal out for free get thanked for it, the one
that keeps it behind a paywall gets called a ransom, and since 1.10 a free
Vidlun reads only its newest entry. The owner asked for the design first.

- **The design is a new canvas**, https://claude.ai/artifact/J1n7iM2bndHj4AUhchRL3B
  ("Vidlun 1.11 — дизайн"): all of 1.11 redrawn from the code, plus a page
  "Експорт (новий)". The owner chose it to replace `Vidlun.dc.html`, since
  the standalone Claude Design closes on 14 December. CLAUDE.md rule 6
  still names the old file.
- **The owner's word on it:** the archive carries the voice; the row keeps
  the name «Експорт для читання»; each link to a voice sits above the
  entry's words. And «Відновити з копії» now reads only «Відкрий файл
  резервної копії — і записи повернуться у щоденник.» (English: "Open your
  backup file, and your entries will come back to the journal."), without
  "Для нового телефона або після перевстановлення" and without "разом з
  аудіо".
- **On «Я»:** a row between «Резервна копія» and «Відновити з копії», built
  like the backup's, pill «Експорт», its line «Усі записи текстом і з
  голосом — для зручного читання або щоб поділитися з фахівцем.»
  (owner's wording, set right: "щоб поділитися" to match "для читання";
  "фахівець" rather than "терапевт", which alone reads as a GP in
  Ukrainian — owner's choice). While it runs its line reads
  «Готуємо експорт…», then «Готуємо експорт: аудіо 3 з 12». Free, every
  entry in it, a closed one too.
- **The file:** «Vidlun — записи до 19.11.2026.zip» (English: "Vidlun —
  entries to 2026-11-19.zip"), holding that folder with «Щоденник.md» and
  `audio/` with one AAC per entry that kept its voice, named by when it was
  said ("2026-11-18 21-10.m4a", a second one in the same minute gets
  " (2)"). The Markdown is `ExportJournal`'s, unchanged but for one line,
  `[Голос](audio/2026-11-18%2021-10.m4a)`, between the time and the words.
  A voice that will not copy is left out, and so is its link: the journal
  is written after the voices.
- **The ZIP is written by the app** (`modules/vidlun-backup/ios/ZipFolder.swift`),
  stored, not deflated. Foundation's own ZIP (a folder read "for
  uploading") stores the names as UTF-8 without the flag that says so, and
  Windows shows "Щоденник.md" as "╨⌐╨╛…"; checked on the Mac. Ours sets bit
  11 on every name; Python's zipfile and `ditto` read it back exactly, CRCs
  and bytes included. The classic format's 4 GB and 65,535-entry limits are
  checked, not assumed.
- `ExportReadableJournal` (8 tests), `IReadableArchive`,
  `NativeReadableArchive` (staging and the finished file in two cache
  folders of their own, which `CacheLeftovers` now sweeps). The old
  Markdown-only share is gone from the app; `ExportJournal` stays for the
  Markdown and the backup's JSON.
- **Still to do when it ships:** the privacy policy's §5 names only the
  backup as the way to take everything along; add the readable export back
  in both languages and redeploy with that release, not before.

---

## 3ψψψ+++++++++++++++++++++++++. A way out of the card before saving — 2026-11-19

The owner noticed that an entry, once heard, could not be left: the card
had no way out but saving. "Давай додамо кнопку видалення" — on the card,
before the entry is saved. The design is silent here (the 14 Sep export
draws "Видалити" only on a saved entry's page), so the card takes the bin
the app already uses there.

- **The card has a red bin at the top right**, `trash-2` in `danger`, the
  same control as a saved entry's page (owner's word, 2026-10-01 there).
  It asks first in the same words — "Видалити цей запис?", "Залишити" /
  "Видалити" — so no new copy. 22pt down to the words, as from the back
  button on choosing together.
- **`discardEntry`** goes home with nothing saved. The take's file is
  removed at once (`letTakeGo`), and a "talk about yesterday" time is
  forgotten. A typed entry goes the same way.
- **A reading still on the way says nothing.** One that lands finds home
  and changes nothing (`whenAnalysisLands` only touches a card). One that
  fails used to say "no network" whatever the stage; a count of cards put
  up (`cardsAsked`) now keeps that toast for the card it was asked for.
- Choosing together keeps its back button: the bin is one step back, on the
  card.

---

## 3ψψψ++++++++++++++++++++++++. A call no longer leaves the take deaf — 2026-11-19

The owner rang the phone mid-take: the recording screen went on as if
nothing had happened. That was half good news. expo-audio pauses every
recorder when iOS interrupts the audio session (a call answered or ringing,
Siri, an alarm) and on the interruption's end restarts only its players
(`AudioModule.swift`, `handleInterruptionBegan` / `handleInterruptionEnded`),
while the screen's clock is its own. So the take could stop hearing at the
call, with the clock still counting, and whatever was said afterwards was
lost without a word. Whether a ringing call alone interrupts was not
measured; an answered one does.

- **The adapter reads it off the status.** `IAudioRecorder.interrupted()`
  is true when the recorder stopped recording under a take nobody paused
  (`ExpoAudioRecorder.watchForSystemHold`, on the poll that already watches
  the ceiling). It waits until the recorder has once said it is recording,
  so a status that lags the start is not taken for a call. Pause, resume and
  the take's end clear it. Five tests.
- **The screen holds and asks**, the same way as leaving the app: the take
  pauses and "Запис на паузі" offers "Продовжити запис" or "Вийти". What
  was said before the call stays. If the call took the screen too, the
  question waits until the app is in front again. No new copy, no new
  screen. (The owner's word: "так, роби".)
- **Not covered:** "Продовжити запис" pressed while the call still holds
  the microphone. expo-audio marks the recorder as recording whether or not
  iOS let it start, so nothing can tell; the person would normally answer
  the question after the call.
- **Needs a real phone** to confirm: a long take, a call from another phone,
  answered and not. A simulator gets no calls.

---

## 3ψψψ+++++++++++++++++++++++. The support page and the policy catch up — 2026-11-19

The competitor analysis (`reports/`, not committed) turned up public texts
that no longer matched the app; the owner said to fix them.

- **Support page** (`legal/SUPPORT.*.md`, site only):
  - a recording stays until the person deletes it — it said a year and
    then gone, true only before 1.10;
  - the opening says "how your day went", like the landing page, instead of
    "one sentence about the day";
  - the switch is named as the profile names it, "Save audio" /
    «Зберігати аудіо» (it said "Keep recordings");
  - the reinstall answer points at "Restore from backup";
  - the Ukrainian heading "Я переставив застосунок…" showed a gender; it
    is now "Після перевстановлення застосунку зникла підписка".
- **Privacy policy §5**: the profile has no "Readable export" since
  2026-09-17, so "take everything with you" names only Backup, audio
  included; the switch is named as above. Still effective from 19 November.
  The in-app copies are rebuilt (`build-legal.mjs`) and ship with the next
  build.
- **Deployed 17:58 the same day** (owner's word); the live text matches the
  build.
- **The retention table still said "Keep voice recordings" / «Зберігати
  голос»**, missed in the first pass (the updated competitor report caught
  it). Both rows in both languages now name "Save audio" / «Зберігати
  аудіо», the in-app copies are rebuilt, and the pages went out at 19:34
  (owner's word); the live text matches the build.

---

## 3ψψψ++++++++++++++++++++++. No echo, for now — 2026-11-19

The owner asked what the echo gives a person, and then: "давай поки
приберемо". With variant A the line under the player and the voice portrait
already say how an entry sounded, so the echo mostly said it a third time;
the one thing only it could say — the words and the voice going different
ways — was the rarer case.

- **Nothing writes an echo any more.** Gone: `WriteEcho`, `IEchoWriter`,
  `ClaudeEchoWriter` (Sonnet 5, its prompt and `echoRegister.json`),
  `FakeEchoWriter`, `ECHO_MODEL`, the call after saving in both save paths,
  and their tests. One model call per entry fewer, and the mood and
  emotions are no longer sent after saving.
- **The entry page shows no echo card**, not even for an entry that has one.
  `MoodEntry.observation` stays, and the Markdown export still writes it.
- **To bring it back:** everything is in 499ce5e (`git show
  499ce5e:src/infrastructure/analysis/ClaudeEchoWriter.ts`, and the same
  for the files above). The shape worth trying then is the narrow one
  discussed: write only where the voice and the words go different ways,
  and say nothing otherwise.
- **The texts that still named it, fixed the same day** (owner's word):
  - The processing title is "Читаю твій запис" / "Reading your entry"
    (it was the design's "Складаю відлуння"; the one before that,
    "Читаю те, що ти сказав", showed a gender).
  - The capture card no longer has the "Відлуння" panel under the words
    when nothing was heard: the card above it already says so in
    `compare.noneCopy`, and its fixed line was gendered ("Ти розповів, що
    робив"). The panel for a draft's observation went with it — a draft
    has carried none since 2026-10-30. `compare.echo` and
    `compare.noneEcho` are gone from both locales.
  - The terms (what the model does) and the privacy policy (what is sent,
    and why) no longer mention the echo; both are effective from 19
    November. The site's privacy FAQ the same. The in-app copies are
    rebuilt (`build-legal.mjs`) and ship with the build. The web pages
    went out the same day, before 1.11 was released (owner's word), with
    one sentence added to the policy's §2.1 so it stays true for everyone
    still on an older version: versions up to and including 1.10 also
    send, after an entry is saved, the mood and the emotions chosen, to
    write a short echo about it. Deployed 16:15; the live text matches
    the build.
  - The review notes for 62 drop the echo (scratchpad
    `review-notes-62.txt`).

---

## 3ψψψ+++++++++++++++++++++. The entry page, variant A: the voice in one line — 2026-11-19

The owner found the entry page plain ("просто і скучно") and asked for a
couple of variants and a way to show that the voice is analysed. Three
mockups (A: the voice in one line under the player; B: a five-scale voice
portrait against the usual voice; C: the entry as a conversation with
Vidlun); the owner took **A**. The design draws no entry page, so A is the
mockup, made from the app's own tokens.

- **The voice line**, inside the player's card under a hairline, in the
  accent (Vidlun speaking) beside the wave mark: "Голос тихіший і
  повільніший, ніж зазвичай" / "Your voice is quieter and slower than
  usual"; pauses join as their own clause ("…, і більше пауз"); "Голос як
  зазвичай" when nothing stood out; "Ще замало записів, щоб порівняти голос
  зі звичним" while fewer than five other takes were heard; nothing for a
  take with no speech in it. Always the voice as the subject, never a
  verdict on the person, never a number (`voiceLine`).
- **Honest states** come from `DescribeVoice.hearEntry` → `VoiceHeard`
  (`compared` / `learning` / `silent`), measured on opening if the reading
  is missing; loaded beside the recording when an entry opens.
- **The played part of the wave is in the entry's mood colour**
  (`Playback.tint`), and the mood is a chip in its soft colour and its ink.
  A had put it in one row with the emotions without captions; the owner
  brought the captions back the same day ("потрібно пояснювати юзеру, що це
  таке"): "Настрій" beside the mood chip, "Емоції" over the emotion chips.
  Topics and the echo stay as they were.
- Seen on the iPhone 18 Pro simulator with eight voiced test entries (the
  newest made quieter): "Голос тихіший, ніж зазвичай", the green played bars,
  the mood chip.
- **Home's entry card lists its emotions as the journal's card does**
  (owner's word, the same day): all of them under the sentence, in the one
  blue, joined with " · ", in place of the first one alone at the top right
  (`EntryRow`). A locked card keeps its lock at the top right.
- **The voice portrait from variant B, behind the line** (owner's word, the
  same day): a tap on the voice line (it gains a "›") opens a sheet rising
  from the bottom over nearly the whole screen (`ModalSheet tall`, 90%):
  "Як звучав голос", the line itself as the headline, a "твоє звичне"
  legend, and five rows — loudness, pitch, liveliness, pace, pauses — each a
  line with the person's usual band and this take as a dot (accent when
  marked, grey within the band) and one word ("тихіше", "як завжди", …).
  Under them only "Порівняно з твоїми попередніми записами." (owner's
  wording). The scales come from the same computation as the line
  (`voicePortrait`, which `compareVoice` now reads its marks from), so the
  two can never disagree; the line spans three spreads either side of the
  usual middle (`placeOnScale`, `usualBand`). No numbers on screen. While
  too few takes were heard there is nothing to open, and the line is plain.

---

## 3ψψψ++++++++++++++++++++. A promo code: six months free — 2026-11-19

By the owner's word ("секцію де можна вести купон і весь функціонал буде
безкоштовний ... на пів року"), and their two choices:

- **Apple's offer codes, not our own.** A code of ours unlocking the paid
  half would break App Review's rule 3.1.1 (no own keys or codes to unlock
  functionality). An offer code on the monthly subscription is Apple's:
  the person types it into the store's own sheet, gets the subscription free
  for six months, and it renews at the normal price after that unless
  cancelled — the sheet says so. Nothing to check on our side.
- **Where**: "Маю промокод" / "I have a promo code" under "Restore
  subscription" on the plan page (every state of it), and under
  "Підключити" in the Subscription card in Me while there is no plan.
- **How**: `IPurchases.redeemCode()` opens the sheet
  (`Purchases.presentCodeRedemptionSheet`), and `onStatusChange` (RevenueCat's
  customer info listener) re-reads the status the moment the store grants
  it, so everything opens without a relaunch. `FakePurchases` grants a code
  1.5 s after the sheet for walking the screens; the other two stores grant
  nothing.
- **Seen** on the iPhone 18 Pro simulator: both links; the tap reaches
  StoreKit, which answers "No active account to present code redemption
  sheet" — the simulator has no Apple Account. The sheet itself shows on a
  phone signed into the App Store.
- **Made in App Store Connect the same day** (owner's word: shared code
  VIDLUN6, 20 redemptions, until the end of 2027). Offer "VIDLUN6 six months
  free" (`2b251efb-d50b-46d7-a7d7-df9d71f8fdc8`): free for 6 months, for new,
  current and lapsed subscribers, replacing the 3-day trial rather than
  adding to it, all 175 territories. Custom code VIDLUN6 (`660568`): Apple
  refused 20, 50, 100 and 250 redemptions and took **500**, the smallest it
  accepts; and a custom code's end date may be at most six months ahead, so
  it has **no end date** (owner's choice) and is to be switched off at the
  end of 2027: `PATCH /v1/subscriptionOfferCodeCustomCodes/660568`
  `{"active": false}`.
- **Works before the in-app button ships**: the code can be redeemed in the
  App Store already (the redeem link with the app's id and the code), and
  the app reads the subscription from the store on launch.
- Open: whether the terms name promo codes beside the trial.

---

## 3ψψψ+++++++++++++++++++. iPhone Duo: checked, and the content in a column — 2026-11-18

By the owner's word ("давай глянемо як наш застосунок буде під iPhone Duo"),
on the iPhone Duo simulator (iOS 27.2) with build 60 and a demo journal.

- **Apple's requirements were already met**: a launch screen
  (SplashScreen storyboard), the scene life cycle (since 1.9.1),
  `UIRequiresFullScreen` false, no `UIScreen.main`, orientation or idiom in
  our Swift, and the React Native side reads the window through hooks that
  follow it and keeps each side's safe area apart. Xcode's app-resizability
  skill found nothing to migrate.
- **Seen**: closed (466×678) as on a phone, the status bar along the right
  side kept clear; open and half open (951×669) edge to edge, re-laid out
  live as the hinge moves, nothing clipped, home scrolls. But the phone
  layout stretched across ~880pt: wide day pills, a tab bar across the
  whole screen, very long lines.
- **The content in a centred column** (owner's choice of three: column,
  a drawn wide layout, or leave it). `COLUMN_MAX_WIDTH` 600 in
  `presentation/theme/column.ts`; `useDrawnSides` adds the space around the
  column to each side (the larger of it and the safe area, never both), the
  tab bar follows, and both sheets make their card the column
  (`useColumnSurface`), so a sheet is not a strip across 951pt. Backgrounds
  stay full bleed. A phone is untouched: under 600pt the margin is zero.
  Seen on the open Duo: home, the journal and the filter sheet stand in the
  middle; closed, nothing changed.
- **Not done**: a wide layout of its own (needs the design first), and the
  "Made for iPhone Duo" badge, which wants iPhone Duo screenshots in App
  Store Connect besides the iOS 27.1+ SDK build.

---

## 3ψψψ++++++++++++++++++. The month hears the voice — 2026-11-18

By the owner's word: the voice analysis goes into the monthly piece, "how
your voice sounded", in the same plain words as the rest of the month (the
rules of 2026-11-06, §3ψψψ++++++).

- **Each spoken entry of the month carries its voice** to the model, after
  its words: `| voice: quieter, slower` or `| voice: as usual`. A typed
  entry, one not measured yet, or one heard too thinly to compare carries
  nothing, so a month without any voice reads exactly as before.
- **Against the whole history, from the readings already kept**
  (`DescribeVoice.ofSaved`): each entry is set against every other reading
  on the phone rather than the latest thirty, so October is not heard
  against how the person sounds in November. Nothing is measured on the
  way; `MeasureVoices` does that on opening.
- **Never for a hard entry** (`distress`, `crisis`), as with the echo. A
  voice that cannot be read leaves the month to its words.
- **The prompt** (`NARRATIVE_PROMPT_VERSION` 4): one sentence at most on
  the voice, inside the same three or four sentences under 70 words; only
  when it adds something the words do not — the same change on several
  days, or a voice that went against the words; left out when it was
  mostly as usual or changed on one day. Said about the voice ("your voice
  sounded quieter and slower towards the end of the month"), with the voice
  as the subject so Ukrainian shows no gender; never a verdict about the
  person, never pitch, loudness, measuring, the phone or numbers.
- **Cached months are written once more** (the version is in the
  fingerprint), and then the voice does not rewrite them: "usual" moves
  with every new take, and a month paid for again each time it is opened
  would be worse than one written with the voice as it was heard then.
- **Privacy policy** (uk/en, the 18 November text): the monthly piece also
  sends the same few words on the voice for spoken entries. In-app JSON and
  `legal/site` rebuilt, not deployed.
- **Not tried against the real model**: the proxy answers only an attested
  app, so the first month with the voice will be read on the phone.

---

## 3ψψψ+++++++++++++++++. The backup carries the voice — 2026-11-18

By the owner's word ("берись і по дефолту і аудіо бери"): the backup holds
every recording still on the phone, by default, with no switch.

- **One file**: an Apple Archive (`vidlun-backup-YYYY-MM-DD.aar`) with
  `journal.json` (the codec's export, unchanged) and `audio/<entry id>.m4a`.
  Recordings go in as AAC at 24 kbps — about a sixth of the WAV, measured on
  a speech sample — and come back as the 16 kHz WAV the app keeps, dated as
  the entry. A JSON backup made before 1.10 still opens.
- **Native, no dependency**: `modules/vidlun-backup` (Swift, AVFoundation and
  AppleArchive), streaming disk to disk. `NativeBackupArchive` stages in the
  cache; where the module is absent (tests, Android for now) the backup is
  the JSON alone. Apple Archive refuses paths that leave the folder
  (`../`, absolute): checked with a crafted archive, extraction stops and
  nothing escapes; the restore then says the file cannot be read.
- **Use cases**: `BackUpJournal` (progress per recording; the profile's line
  says "audio 12 of 240") and `RestoreJournal` (merges entries as before,
  then brings each recording back, however old, unless keeping recordings
  is off, the entry already has audio, or is not here; an unreadable
  recording is skipped).
- **Copy**: the backup and restore lines mention audio; the restore alert adds
  "Повернулося аудіо: N"; the terms (effective 18 November) say the backup
  file carries the audio still kept.
- **No more deleting on a timer** (owner's word, the same day: "we will not
  decide for the person"): `ForgetOldRecordings` and its test are gone; a
  recording stays until its entry is deleted or keeping recordings is
  switched off. The settings and profile lines, the year-ago card's "no
  audio" line, the privacy policy (effective 18 November; "сам" made
  genderless on the way) and the landing say so; CLAUDE.md §1 and §6 record
  it.
- **AAC on the phone too** (owner's word, the same day): `FileRecordingStore`
  keeps `<entry id>.m4a`. A take still arrives as WAV (the speech model needs
  it) and is moved into place at once, so confirming waits on nothing; it is
  compressed right after, and on every open `CompactRecordings` converts any
  WAV left (every recording made before, a compression a closed app cut
  short). The AAC keeps the WAV's date. A WAV whose entry is deleted during
  compression leaves nothing behind. The backup copies AAC files as they are
  and the restore keeps them as they came — no decoding back to WAV. Playback
  and the voice measures read AAC through AVAudioFile as before. The Keep
  audio line in Me is now just "Аудіозаписи зберігаються на цьому телефоні."
  (owner's word).
- **Not done**: Android (needs its own AAC and archive; until then it keeps
  WAV and a text-only backup).

## 3ψψψ++++++++++++++++. Only the newest entry reads free; one affirmation a month — 2026-11-17

By the owner's word, for 1.10 (the build after 59). Decided in four answers:
the newest entry only (not "today's and one before"); the locked card keeps
its day, time and mood colour with the words under the glass; daily and
weekly affirmations need the subscription; the same for entries written
before the rule (no grandfathering).

- **The lock** (`FREE_ENTRIES_OPEN = 1`, `entriesOpen`): counted over the
  whole journal newest first, so a filter never opens an older entry.
- **The journal** (the owner's third pass the same day: a glass and a lock
  on every card read as a wall of placeholders; one glass over everything
  left nothing to delete). Every locked entry is still its own card —
  `EntryRow` with `lockedHint`: day, time and mood colour, a small lock
  where the emotion was, one faint line (`LockedLine`) where the words were,
  no "read with a subscription" written anywhere. A tap opens the
  subscription; a swipe or a hold deletes it, as on home.
- **Home, for every plan**: the last entry only (`RECENT_LIMIT = 1`).
  Without a subscription the month-ago card stands with a lock and a faint
  line and opens the subscription; the year-ago card is not shown. With one,
  both cards as before. `LockOverlay` moved out of the stats screen into
  `LockGlass.tsx`; nothing of an entry is drawn on a locked card.
- **No flash either way**: the store's answer is null until it comes, and
  home and the journal hold the entries back until then, so a subscriber
  never sees locks and nobody sees words that then lock. A store that fails
  counts as no subscription, as before.
- **The affirmation** (`affirmationFrequencyFor`): without the subscription
  it comes monthly and a pick is kept to the 1st, whatever was chosen. In
  Me, monthly is lit and daily and weekly carry a lock and open the
  subscription; the stored choice is untouched, so subscribing brings it
  back. The kept one is not read, and the mornings are not rescheduled,
  until the store answers.
- **Still free and complete**: deleting (swipe or hold, in the journal and
  on home), the backup and the Markdown export (every entry in full).
- **Three free days** (owner's word, the same day): a Free introductory offer
  of 3 days on the monthly subscription, set up by the owner in App Store
  Connect. The app reads the days from the store (`trialDaysOf`) and now
  promises them only to people RevenueCat reports as eligible
  (`checkTrialOrIntroductoryPriceEligibility`; "unknown" or a failed check
  shows the plain price). Under the price, with a trial: when the charging
  starts (`subs.noteTrial`; the line about cancelling went, owner's word).
  "Trial week" became "free trial". The terms (no price, as before: once
  per Apple ID, nothing charged if cancelled within the 3 days) and the
  site's plan note say so.
- **Copy**: the subscription screen lists what it gives (whole journal,
  unlimited entries, the month's piece, the week's topics and patterns,
  daily or weekly affirmations) in place of the lead paragraph; the terms (effective 17 November;
  the 16 November text was never published) and the landing's free and paid
  lists. Not in the design file: it has no locked entry or locked frequency.

## 3ψψψ+++++++++++++++. The owner's list of 2026-11-16

All for the next build (59), by the owner's word.

- **Swipe back** from the left edge on every screen with a back button
  (`SwipeBack`, react-native-gesture-handler, no new dependency): it does
  what that screen's button does (`swipeBackFor`), the screen follows the
  finger and goes back past a third of the width or on a fling; under
  Reduce Motion it does not move. §7.5's "nothing slides sideways" is about
  transitions the app plays; this one is the finger. Seen on the entry page
  in the simulator.
- **Home**: the run of days at the top right went; the journal's round
  affirmation button moved there (waiting mark, or the picked one's face,
  which grows over home), and left the journal; the pill under the record
  button went. "Натисни, щоб розповісти" sits 16 points higher, inside the
  record button's halo.
- **Then, the same day, also by the owner's word:** the date is back at
  home's top left, beside the affirmation button; the last **two** entries
  are back under the record button (`RECENT_LIMIT` 2, `EntryRow` restored,
  with its swipe to delete); and the month-ago card (with the year-ago one)
  is back where it was, under the record button above those entries.
- **Journal cards**: the first emotion at the top right went; the emotions
  under the sentence are the one blue (`palette.tag`).
- **The affirmation page** has no "Готово"; the X closes it.
- **The kept affirmation's period follows the frequency now** (owner's bug:
  weekly, then daily, and the morning's notification opened on last week's
  pick with no way to choose). `KeepAffirmation.current(frequency)` measures
  the period from the pick under the current frequency; the flow reloads it
  when the frequency changes.
- **No notification for a period already picked**: the affirmation is no
  longer one repeating rule but the mornings ahead, one by one
  (`affirmationMornings`: 14 daily, 8 Mondays, 6 firsts, at ten), skipping
  any before the kept pick's end, rescheduled when the app opens, the
  frequency changes or one is picked. Identifiers `affirmation-<time>`; the
  old repeating `affirmation` still counts as one, so it is cancelled.
- **Two entries a day free, no limit with a subscription or its free week**
  (`FREE_ENTRIES_PER_DAY`, `mayWriteAnother`; `HomeView.writtenToday`). The
  record button, "type instead", yesterday's entry, the widget and Siri all
  go through it; past the limit they open the subscription. The
  subscription's lead line, the terms (effective 16 November) and the
  landing's free and paid lists say so; the site goes out with 59.
- **"Час для себе" (thinking, not built)**: iOS lets no app silence other
  apps' notifications or switch a Focus on. What is possible: (1) a Focus
  filter (App Intents `SetFocusFilterIntent`), so that when the person's own
  Focus is on, Vidlun quiets its reminders and can open on a calm page;
  (2) a ready-made Shortcut, shared by an iCloud link, that turns on Do Not
  Disturb for N minutes — Shortcuts can, apps cannot — offered from inside
  the app with one tap; (3) inside Vidlun, a timer that pauses its own
  reminders and affirmation for that time. Recommended: (3) with (2) as the
  way to quiet the rest of the phone, and (1) later.

---

## 3ψψψ++++++++++++++. Home invites the affirmation; the month-ago card on top — 2026-11-14

By the owner's word, for the next build (59).

- **Home invites the affirmation** while this period's is still to be picked
  and affirmations are on: a quiet pill under "Спробуй текстом" with the
  journal's waiting mark (the head with a spark, `AffirmationMark`, now its
  own component) and "Вибери афірмацію" / "Pick an affirmation"
  (`home.pickAffirmation`). It opens the five, as the journal's button does,
  and is gone once one is picked; the journal keeps the picked one.
- **The picker's heading** wears the same mark beside "Вибери афірмацію"
  (`affirmation.title`, was "Обери одну").
- **The month-ago card (and the year-ago one, when there is one) sit above
  "Як ти сьогодні?"**, so the record button and today stay together under
  the question. With the update line and an echo both up, the invitation
  scrolls under the tab bar on a small screen.

Seen in the simulator on Metro: the pill on home, the picker's heading, and
the echo above the title (shown by pointing it at the latest entry for a
moment, since the simulator's journal has none from a month ago).

The same day, also by the owner's word: **home lost the last three entries
under the record button and the date over the week strip**. The journal tab
is where entries live, and the strip already says which day it is; the run
of days stays at the top right while there is one. `EntryRow` and
`SwipeGroup` (the swipe-to-delete row) had no other user and went;
`dayWordOf` moved to `components/dayWord.ts` for the journal's cards.

---

## 3ψψψ+++++++++++++. 1.9 closed on opening under iOS 27; 1.9.1 — 2026-11-13

**What happened.** 1.9 (57) went live (the owner released it) and closed on
opening for everyone on iOS 27. The crash logs, pulled from the owner's
iPhone (iOS 27.0.1) with `xcrun devicectl`, all stop in UIKit's
`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` (SIGTRAP):
an app built with the iOS 27 SDK must use the UIScene life cycle. Builds
54–57 were archived with Xcode 27.2 — 26.6 was no longer on the Mac — and
Expo 57's template still makes the window in the app delegate. The note
saying to release with Xcode 26.6 was not checked. The iPhone 17 and 17 Pro
simulators run iOS 26.5, where the app opens, which is why nothing caught
it; an iOS 27.2 simulator ("iPhone 17 Pro iOS27") reproduces it at once.

**The fix** (`plugins/withSceneDelegate.js`, `plugins/scene/SceneDelegate.swift`,
6424330): a scene delegate makes the window from the scene and starts React
Native into it, puts a cold-start link into the launch options, and hands
the scene's life-cycle, URL and user-activity events to the app delegate,
where Expo's subscribers and Linking listen. Modelled on Expo 58's
`ExpoAppSceneDelegate`, which replaces it when the project moves to 58.
Checked on the iOS 27.2 simulator: opens, survives going to the background
and back, takes `vidlun://record`; and on iOS 26.5 with the demo journal.

**1.9.1 (58)** is exactly 1.9 (57) plus that fix, built from the branch
`hotfix-1.9.1` (b262536 + the fix + the bump), uploaded 2026-11-13 07:40,
submitted the same morning (review submission 8d61082f…, release after
approval), What's New "Fixes Vidlun closing right after opening on iOS 27.
Sorry for the trouble.", the review notes opening with the fix; an
expedited review was requested and accepted ("We'll expedite review for
Voice journal: Vidlun"). The work of 2026-11-12 (the bars, the voice, the
echo) waits for the next build, 59.

**From now on**: before any release archive, open the Release simulator
build on the iOS 27.2 simulator.

---

## 3ψψψ++++++++++++. The voice in the suggestions, and the echo back — 2026-11-12

By the owner's word, for 1.9 (58): suggest the emotions more precisely with
the voice, and bring the echo back as a short note on the voice against the
words. Tone, the owner's: warm, calm, human, unobtrusive; not grand,
poetic, psychological, medical or formal; natural for a native speaker.

- **How a voice sounded is said against the person's own usual voice**
  (`compareVoice`, `VoiceCue`): the median and spread of their last thirty
  heard takes, and a mark where a take sits a spread or more away — quieter
  or louder (one and a half, since it moves with how the phone was held),
  lower or higher, flatter or livelier, slower or faster, more or fewer
  pauses. Nothing until five takes were heard; brightness left out.
- **The suggestions hear it.** The take is measured while it is recognised
  (`DescribeVoice.ofTake`, given 1.5 s and never waited on past that) and
  the analysis gets one line after the words, in a block of its own:
  "Voice: quieter, flatter." The prompt keeps it a weak hint: it may tip
  between words the sentence supports and add one or two offered words,
  never an emotion the words give no ground for, never the mood, never the
  safety flag. A typed entry, or too few takes, sends the words alone, as
  before.
- **The echo is written after saving** (`WriteEcho`, `ClaudeEchoWriter` on
  Sonnet 5), not on the card: the card waits no longer, the observation
  still comes only after the person has answered (§9), and it reads their
  answer — the mood and the emotions they kept — beside the words and the
  voice. Its own prompt carries the owner's tone, present tense only in
  Ukrainian (no past tense or adjective that shows a gender), one sentence
  of fifteen words or so, null when there is nothing to say. Never for a
  distress or crisis entry. It appears on the entry page's existing echo
  block; home is read again when it lands. The Ukrainian examples live in
  `echoRegister.json`, since no Cyrillic may sit in a .ts file.
- **Free**, for now: one more call per entry, after saving.
- **Not checked against the real model**: no key here, and App Attest keeps
  the simulator from the proxy. The plumbing was seen in the simulator with
  the fake writer (a typed entry, saved, its echo on the entry page), and
  the request, the parsing and the prompt are under test. The owner sees
  real echoes in 58.
- **Privacy policy and terms** (in the app, 12 November) now say a spoken
  entry also sends a few words on how the voice sounded — never the
  recording or the measurements — and that the echo sends the mood and
  emotions chosen. The landing's privacy point and FAQ say the same in
  `site/src/copy.json`, **not deployed**: they go out with 58.
- Not done: an echo for an entry heard late (saved offline), the saved
  screen staying long enough to show the echo, and the voice in the backup.

---

## 3ψψψ+++++++++++. The bars hear the voice, and the phone measures it — 2026-11-12

Both by the owner's word, for 1.9 (58). The goal the owner named: to show
later, in the statistics, how heavy or light an entry sounded.

- **The recording screen's bars move with the voice.** They were a loop
  that never heard anything. The recorder's port gained `level()`, read
  from expo-audio's metering (already on) and spread from -50 to -12 dBFS
  over 0..1 (`levelFromDecibels`). The screen reads it every 70 ms, rises
  at once and falls more slowly, and multiplies each bar's own rhythm by it
  on the native driver: silent, a low breathing line; loud, the whole tent.
  Paused, the row settles; Reduce Motion keeps it still, as before. Seen in
  the simulator with `say` playing into the Mac's microphone.
- **The voice is measured from the kept recording, not the live
  microphone** (`modules/vidlun-voice`, Swift with Accelerate). The take is
  already on disk as 16 kHz PCM, so measuring touches nothing about
  recording, and a failure costs a reading, never a take. 40 ms frames
  every 20 ms; speech is what stands 12 dB above the quietest tenth.
  Measures (`VoiceReading`, version 1): speech length; median pitch and its
  low-to-high-tenth range in semitones (normalised self-correlation, first
  peak near the best so a voice does not read an octave low); median
  loudness and its swing; the share of the speaking stretch in pauses of
  0.26 s or more; pace as loudness beats per second on a 30 ms / 10 ms grid
  (it catches about half the syllables, and holds steady across voices);
  brightness as the power-weighted mean frequency from how fast the signal
  changes against its size. A minute of speech takes 0.03 s on the Mac.
- **Checked on the Mac** with a command-line harness around the same
  Swift: tones of 200 and 120 Hz read 200.0 and 120.0 Hz with brightness
  199.9 and 120.2; a 120→240 Hz glide 9.4 semitones; one second of silence
  in three, 32.5 % pauses; silence, nothing. `say` voices: Ralph 77 Hz,
  Fred 101, Samantha 178, Kathy 207; Samantha's pace 2.2 slow, 2.4 normal,
  4.5 fast. Then end to end on the iPhone 17 Pro simulator (Release build):
  a take spoken by `say` was saved and measured on its own — pitch 177.8 Hz,
  against 177.6 from the file itself — and deleting the entry took the
  recording and the reading with it. Loudness, pace and brightness came
  out different through the speaker and the room, which is why the numbers
  are for comparing a person with themselves.
- **When**: after a save, on opening and on coming to the front
  (`MeasureVoices`, 40 a pass, one at a time, single-flight). Recordings
  kept before this existed are measured the same way, so the history is
  there from the start; a reading from an older analysis version is
  measured again. Only kept recordings: with keeping off there is no file.
- **Kept** in `vidlun.voiceReadings` (AsyncStorage, one JSON object by
  entry id). The readings outlive the audio's thirteen months; deleting
  the entry forgets its reading; turning "Keep voice recordings" off
  forgets them all. Not in the backup file yet.
- **Privacy policy**: a row for the measurements on the phone (numbers, not
  sound), effective 12 November 2026; the site's copy goes out when 58 does.
- **Shown nowhere yet**, on purpose. From a voice, energy (lively or flat)
  can be heard reliably; heavy against light much less so, since a glad and
  an angry voice sound alike. The plan: collect on the owner's own entries
  for two or three weeks, see whether the numbers follow the moods they set,
  then decide with the design what the statistics say. Android needs its
  own analyzer behind `IVoiceAnalyzer`.

---

## 3ψψψ++++++++++. The period pill names the days, choosing together goes back to the card — 2026-11-12

Both by the owner's word, seen in the simulator. In **1.9 (57)**, uploaded
2026-11-12 15:56 ("Upload succeeded"; app and widget 1.9 (57), Parakeet
Ultra q4_0 inside, 382 MB); 56 is superseded.

**vidlun.app's terms and privacy were redeployed the same day** (owner's
word) with the Parakeet Ultra / NVIDIA credit (CC BY 4.0), the 2 November
texts and no echo — what the app itself carries. The landing first went
out unchanged, built from dd1813a, because `site/src/copy.json` held the
consent release's copy. Later the same day the owner dropped the consent
idea and asked for the landing in plain words: it was rewritten in both
languages and deployed. What leaves the phone is said as it is — only an
entry's text, to Claude by Anthropic, to suggest emotions, no voice, no
name, not kept by us. "125 emotions" became 76, the decorative words are
ones the app still offers (in its own labels), the footer's link to a
consumer-health section that does not exist went, and the share images
carry the new headline (`site/tools/og.py`). Then, by the owner's word, "What Vidlun does" became six cards
in three columns: emotions suggested with a slot for one's own word, what
affects you (the week's patterns, marked as subscription), the month in
review (subscription), affirmations, a minute for yourself, the voice
staying on the phone. The vocabulary card and its list went, events went
(the app has none yet), and affirmations joined the free list — deployed
the same day, ahead of 1.9 reaching the store.

- **"Your emotions" names the period picked.** Picking the 10th and 11th
  read as too many emotions; the counts were right (checked against the
  journal's dates: only entries from the 10th 00:00 to the 12th 00:00
  count), but the pill said only "лист.", so the list looked like the whole
  month's. `periodLabel` now says the days ("10–11 лист.", "Oct 28 – Nov
  3"), a whole month or run of months by name, and the year only for a
  period that ended in another year. All time starts at the journal's first
  month rather than at 2000. The calendar's summary line uses the same
  wording (`daysLabel`). `GetVocabularyGrowth` lost its unused `wide`.
- **"Save" on choosing together goes back to the card** with the words
  chosen there on it; the card's own "next" writes the entry. Choosing
  together again starts from those words, not from all of Vidlun's. Coming
  back with no words is an answer, so "next" works then too (§6: zero
  emotions is a whole entry).
- **The mood scale is gone from choosing together**; it lives on the card
  alone, where it already was.
- **The unaided answer stays apart.** The card remembers what was named
  before Vidlun's words were seen (`namedAlone`), and that, not the mixed
  list, is written as `selfEmotionIds`; a word of Vidlun's taken off while
  choosing together is still logged as a disagreement (`keptOwnWords`).
- Open: the button on choosing together still says "Зберегти" though it no
  longer saves; the owner may rename it ("Готово").

---

## 3ψψψ+++++++++. Mood dots on the calendar, floating charms, a little volume — 2026-11-11

All by the owner's word, seen in the simulator in both themes. In **1.9
(56)**, uploaded 2026-11-11 19:24 ("Upload succeeded") with Parakeet Ultra
q4_0: the store version stays 1.9 (owner's word), since 1.9 was never put
up for review; 1.10 (55) is superseded.

- **The period calendar's dots are the day's mood** (`entryDays` now maps a
  local midnight to the day's average mood, as the week strip takes it;
  `toneFor` colours it; a day whose entries gave no mood keeps a grey dot).
  The days between a period's ends are sand (`palette.range`) instead of
  lime, which read as one more good mood and was the record button's colour
  (§7.1). On a picked end the dot carries a ring of `onSolid`.
- **The five affirmation shapes float**: a slow rise and fall, a sideways
  drift on a longer period and a sway, each on its own timing, standing
  still under Reduce Motion. The second continuous motion in the app after
  the record button's rings (§7.5), by the owner's ask.
- **They have a little depth** (owner's choice over the flat ones, after
  both were filmed): one radial light per shape in the shape's own box (per
  element it lit a flower's petals as separate balls), a clipped gloss, and
  a drawn shadow on the page that shrinks and fades as the shape rises. The
  layer shadow was dropped: its blur is cut off at the layer's edge and left
  a faint ring.
- **A soft volume across the app, not loudly** ("не плоским, а під 3d,
  не нав'язливо"): `Volume` lays light from the upper left, a gloss, a rim
  and a shaded far edge over a rounded shape, a quarter softer than the
  first try (`SOFTNESS`). On things one touches or that stand for the
  person's doing — the record button (a dark pebble, faint gloss), the
  week's days with entries (lifted, a shadow in the mood's colour; empty
  days stay flat outlines), the streak and entry counts, the journal's
  affirmation button, the chosen mood on the scale, the primary button and
  the active tab. Cards, text, chips and secondary buttons stay flat (§7.7's
  spirit). At night no shadows, less light, nothing glows (§7.6). A long
  pill keeps its gloss level; `rotation`/`originX` pivot it, as a
  `rotate(a x y)` transform did not.

---

## 3ψψψ++++++++. The screen stays on while recording, six words an entry — 2026-11-10

- **The bug** (owner's report): mid-entry the phone dimmed and locked itself,
  and the take stopped hearing them. Locking sends the app to the
  background, where the take is paused on purpose since 1.8 (it asks on the
  way back), so the take was not broken: the phone was. Of the three fixes
  offered the owner chose the screen staying on; recording under a locked
  screen would need `UIBackgroundModes` audio, an explanation and a video
  for App Review, and would keep recording through a switch to another app.
- **How**: `ExpoAudioRecorder` takes a `ScreenAwake` and holds the screen on
  from `record()` until the take ends, is paused or thrown away; a paused
  take lets it sleep again, since its question may wait a long while. The
  container drives it with `expo-keep-awake` under its own tag
  (`vidlun.recording`), failures swallowed: a screen that sleeps after all
  is the old behaviour, not a broken take. **New dependency**, with the
  owner's word: `expo-keep-awake ~57.0.2`. The native module was already in
  the build through `expo` (nested, 57.0.1); the next archive's `pod install`
  links the top-level copy. A lock by hand still pauses and asks, as before.
  Not verifiable on the simulator (it never auto-locks, and a dev build keeps
  the screen on anyway): to be seen on the phone with Auto-Lock at 30 s.
- **Six words** (owner's word): `MoodEntry.MAX_EMOTIONS` 4 → 6 for what the
  person names and keeps; choosing together fills up to six too. Vidlun's
  own answer stays at four (`MAX_PROPOSED` in `draftFromProposal`, and the
  analyzer is still told "at most four"): the room is for the person's
  words, and every extra word the model adds is one more chance to name
  something they did not feel. The card offers eight, so six of eight can be
  picked; at six the "add a word" field goes away, as it did at four. Seen
  on the simulator: six chosen, a seventh refused, and the journal card
  listing all six over two lines. An entry with five or six words in a
  backup will not import into a build older than this one.

## 3ψψψ+++++++. Affirmation cards — 2026-11-06

Owner's feature, owner's choices: their own list of affirmations (not sent
yet), daily / every Monday / the 1st of every month at 10:00, the app's
own style (no design in the file), free for everyone. Monthly was the first
Monday of the month at first; the owner moved it to the 1st the same day,
so a new month's five are there the morning the kept one runs out
(`RepeatRule.day`, a repeating calendar trigger; seen on the simulator as
`UNCalendarNotificationTrigger` day 1, 10:00, repeats). Someone already on
monthly gets the new rule the next time the app opens, since the
affirmation is rescheduled on every opening.

- **"Me" → Affirmations**: a switch, and once it is on a three-way choice
  (Daily / Weekly / Monthly) in the theme picker's track (`Segment`, now
  shared). The line under the name says when it comes («Щопонеділка о
  10:00»); off, what it is. Turning it on asks for notification permission
  then and not before; refused, the switch goes back off, as the reminder's
  does. Settings `affirmationsOn` (off) and `affirmationFrequency` (weekly).
- **The notification** repeats on the phone's own calendar rule
  (`ExpoAffirmationReminders`): DAILY 10:00, WEEKLY Monday 10:00, or a
  CALENDAR trigger with `weekday: 2, weekdayOrdinal: 1`. One rule, fixed
  identifier `affirmation`, replaced on every change.
- **The two kinds of notification no longer cancel each other.** The
  reminder used to `cancelAllScheduledNotificationsAsync` on every open,
  which would have wiped the affirmation. `NotificationCenter.cancel(kind)`
  now cancels by identifier: `affirmation` is the affirmation, anything else
  (the reminders' own and every older random id) a reminder.
- **A tap opens the cards** (`ExpoNotificationTaps`): the live tap through
  the response listener, the tap that launched the app through the last
  response, each once. From the middle of an entry (recording, the card,
  saving, grounding) it waits until home instead of throwing the take away.
- **The page** (`AffirmationScreen`), second version the same day (owner's
  word: the cards were too plain, a small card turning before the words
  was a step too many, and the screen should not always be grey). Five
  circles, clouds and flowers mixed in every set (drawn from two of each,
  so all three kinds always show; the cloud is drawn as wide as the
  others so it does not read as the small one), each a
  different soft colour with a glad Feather glyph (sun, star, feather,
  coffee, moon, sunrise since 2026-11-10; heart, gift, droplet, smile, music
  and umbrella were dropped by the owner's word),
  popping in one after another and scattered a little off a grid. A tap
  grows a circle of the picked colour out of it until it covers the whole
  screen (560 ms), the others fade, and the glyph and the words come up on
  that colour (34 pt, the glyph at 48), with «Готово». Six pastels of the page's own, deeper and
  quieter in the dark theme; they mean nothing, which is why this page may
  have many (§7.1). Reduce Motion skips the growing. Nothing is kept. Dealt
  fresh on every visit from `AFFIRMATION_KEYS`, the keys of
  `affirmations.*.json`. The first version (five dark cards turning about
  their axis) went the same day.
- **Faces, thrown, bigger** (owner's word, 2026-11-10): the icons came off
  the shapes and eight drawn happy faces took their place (smile, grin,
  closed happy eyes, wink, blushing, heart eyes, star eyes, a cat's mouth),
  five different ones a set. And five kinds of shape for the five, so a set
  never holds two of one (owner's word, the same evening: no two circles or
  clouds): circle, cloud, flower, heart and a chubby star with its points
  rounded, each in a new place and order every time. The five are no
  longer a row of three over a
  row of two: `affirmationScatter` lays them across the rest of the page.
  Thrown wholly at random they gathered on one side (owner's word, the same
  evening), so each set now takes one of five balanced layouts (a zigzag
  from either side, two-one-two, one-two-two, two-two-one) spanning the
  room top to bottom, fitted as big as the room allows it, and then each
  shape wanders up to a sixth of its size from its place, a little smaller
  or larger than the next and leaning up to 14 degrees, never touching
  (about 133-148 pt on an iPhone 17, where the row drew 110 at most). Tests
  hold the five's middle near the room's middle both ways. Thrown once the room is measured and kept, so a relayout
  never reshuffles them. The flower lost its white centre, which was a
  backdrop for an icon. The picked face sits over the words on the reveal
  (72 pt) and in the journal's circle (30 pt); a pick stored with an icon
  from before comes back with the plain smile.
- **The pick is kept for its period** (owner's word, 2026-11-06): a day
  when they come daily, Monday to Sunday when weekly, the calendar month
  when monthly. The period is fixed at the pick (`KeptAffirmation.until`),
  so changing the frequency neither stretches nor cuts one short. While it
  is kept, the notification opens it again (the colour grows from the
  middle) instead of five new ones. One record in AsyncStorage
  (`vidlun.keptAffirmation`): the words as shown, not only their key, so
  the owner's real list cannot change a pick already made; and how it
  looked, so it comes back in its own shape, colour and glyph. Not in the
  backup: it lasts a month at most.
- **In the journal**: the owner picked a button in the header (option A of
  three: a button in the header, a strip above the entries, a row in the
  feed by date). The kept shape in miniature, 44 pt like the filter beside
  it, there only while the pick is kept and the affirmations are on in
  "Me". A tap grows its colour out of the button over the journal and the
  tab bar, and closing fades it away onto the journal as it was. With the
  third control the header no longer fits one line at default size, so the
  count, the shape and the filter wrap under the title, as they already did
  at large text.
- **In the journal only, in both states** (owner's word, 2026-11-10). Option
  A of three put a shape beside the date on home the same afternoon; the
  owner took it back off home on seeing it, the icon looking cut (the
  sparkles spilled over a flower's white centre, and a cloud at 44 pt reads
  as a circle cut off). The journal's button is now a plain 44 pt circle:
  before this period's is picked, always the same mark, a drawn head in
  profile with sparks of light inside, on a pastel orchid, a colour none of
  the six picks use (owner's word, after three tries the same day: sparkles
  on lavender, which a pick can also be; a gold wand on a night indigo, too
  dark beside the pastels; the wand on orchid). Feather
  has no such head, and a second icon font for one glyph was not worth it.
  It opens the five; once picked, the picked one's colour and
  glyph, which grow to the whole screen again. A pick made from the journal
  closes back to the journal (`fromJournal` on the stage), its filter and
  place as they were. `AffirmationButton` draws it. The flow reads the kept
  one on every way home (`reloadHome`) and into the journal, and holds it as
  undefined until the store answers, so the waiting mark never flashes up
  before the picked one.
- **The owner's own lists** (2026-11-10), in place of the ten placeholders:
  nineteen in Ukrainian and thirty-three in English, written apart, so
  `affirmations.*.json` are now plain lists per language (`affirmationsFor`)
  rather than translation keys, and a pick is keyed "uk.3". Tidied only in
  typography: a spaced en dash became the em dash the app's copy uses, the
  straight apostrophe in «здоров'я» the typographic one, and a closing full
  stop was added where a line had none. The words are as sent. Every line is
  first person and present tense, so none carries a gender (§7.9). Tests
  hold each list to at least the five dealt, no repeats, every line in its
  language and ending as a sentence.
- Seen on the simulator: the section, the permission prompt, the
  notification in the app («На тебе чекає афірмація»), the tap opening the
  page, flowers and circles in both themes, and the colour growing into the
  words (frames from a screen recording). Not seen: a tap from a
  killed app, and a real Monday.

---

## 3ψψψ++++++. The week's own pattern, a month in plain words — 2026-11-06

- **"What stands out" reads the week, not its month** (owner's choice,
  2026-11-06, from their backup). Read over the month, every October week
  said "with «здоров'я», «Стрес» comes up most often: 5 of 7 entries" — true
  of October, but the owner read it as the same sentence about different
  weeks, and the week of 5 October counted entries written after it.
  `FindMoodPatterns.execute({ weekStart, weekEnd })` now, with the same
  rules; the clock went with the default month. On the owner's journal:
  2–8 Nov «робота» + «Виснаження» 3 of 3, 26 Oct–1 Nov «здоров'я» + «Стрес»
  3 of 3, 19–25 Oct «робота» + «Виснаження» 2 of 3, and 5–18 Oct the "no
  common trend" line. The days sentence lost its month name and says "of
  the week" («2 з 3 найважчих днів тижня — з темою…»).
- **The month in plain words** (owner's word: the tooth as "a storyline
  running through the month" is not how a person talks). The prompt asks for
  three or four short sentences under 70 words, two or three concrete
  things, no metaphors (it names the ones the model used: running through,
  waves, threads, flowing into, holding balance), health said as plainly as
  the person said it, and no past tense addressed to the person. Then
  (owner's word: "текст має бути людським") a close friend telling the
  person how their month looked, a life and not a report: it never mentions
  entries, moods, scores, numbers of days or patterns, uses the person's own
  everyday words, says health gently and without clinical words they did not
  use, and may say "your month" as long as no past-tense verb has the person
  as its subject. `NARRATIVE_PROMPT_VERSION` 3, so cached months are written again the next
  time they are opened. Not tried against the model from the Mac: the proxy
  answers only an attested app, so the first new text will be on the phone.
- **The week's pattern in human words** (owner's word, the same day). The
  topic and the emotion stay in quotes in the nominative, since the app
  cannot decline them, and no verb has the person as its subject:
  «Найважчі дні тижня здебільшого були про тему «робота»: 2 з 3.»,
  «Коли йдеться про тему «робота», найчастіше поруч «Виснаження» — так було
  в 2 з 3 записів.», and when every entry had it, «…поруч завжди
  «Виснаження» — в усіх 3 записах.» (`patternCompanionAll`, `…SameAll`).
  The empty week: «Дні цього тижня були різні — нічого не повторювалося
  настільки, щоб про це сказати.» English follows.
- **The update line can be closed** (owner's word). An X after «Оновити»
  stores that App Store version as `updateLineClosed` in the settings; the
  line stays away until a newer version is out. Seen on the simulator: the
  old dev build shows the line, the X closes it, and it stays closed after
  a relaunch.
- **A split apostrophe is joined.** September came back with "з ʼявилась",
  "здоров ʼя"; the narrative's text has a space around U+02BC or U+2019
  between Cyrillic letters removed. A quote mark after a space is left alone.

---

## 3ψψψ+++++. A rating request after three good entries, an update line on home — 2026-11-05

- **The rating request** (owner's word; the moment was settled on
  2026-10-30: after a save, on home, never inside an entry). Apple's own
  sheet through `expo-store-review` (new dependency, ~57.0.3), because App
  Review 5.6.1 allows no other. `AskForReview` is due when the three latest
  entries all have a mood of 4 or 5 and none is flagged difficult; the
  hook works that out while the saved screen shows and asks 0.7 s after
  home is back (`leaveSaved`). Once per app version (`vidlun.reviewAskedIn`).
  "Not to someone who already rated" is Apple's: the app is never told
  whether anyone rated, and StoreKit shows the sheet to someone who has only
  for a new version and a year after their review, and to anyone at most
  three times a year. The module is imported when first needed, since it
  throws on import in a build without it.
- **The update line on home** (owner's choice of place: home, on top).
  `CheckForUpdate` asks Apple's public lookup
  (`itunes.apple.com/lookup?id=6806530807`) and offers the release when it is
  newer than `Constants.expoConfig.version`, part by part as numbers; a
  build ahead of the store (in review) or an unreachable store shows
  nothing. Checked on open and on coming to the front, at most every six
  hours. «Вийшла нова версія Vidlun» with an ink-ring «Оновити» that opens
  the store page. The request carries the app's id and nothing of the
  person's; the privacy policy does not mention it yet.
- **1.8 was released 2026-11-03 with build 53** (everything free). The next
  version, with the store open again, is 1.9.

---

## 3ψψψ++++. Emotions in the entry's language, no slow-connection line, the store open again — 2026-11-04

- **An entry's emotions are named in the language it was said in**
  (owner's word: Ukrainian speech gets Ukrainian emotion words whatever the
  app's language). `localeOfText` reads the script most of the letters are
  in: Cyrillic is Ukrainian (a Russian entry too, the nearest the app has),
  Latin is English, nothing to go by keeps the app's language.
  `emotionWordsIn(text, t)` gives the translator, and every surface that
  shows one entry's words uses it: the question card's chips and offered
  words, the compare card, the entry page, the journal row, the home cards
  and the year echo. Screens that count across entries (statistics,
  vocabulary, the journal's emotion filter) keep the app's language, since
  their entries can be in both. Topics were already in the speaker's
  language. Old entries follow too: it is read from the transcript, nothing
  is stored.
- **No slow-connection line while the entry is read.** After five seconds
  the processing screen said «Ще працюємо. Зв’язок повільний.», a guess that
  was often wrong; it keeps its hint for the whole wait now. `useAfter` had
  no other user and is gone.
- **The store is open again**: `SELLING = true`. The paywall, the free
  minute and the profile's subscription section are back as in 1.8 (52).

---

## 3ψψψ+++. A take with no words says so, topics with a space, onboarding at large text, everything free — 2026-11-02

- **An empty take has its own notice** (owner's word and copy). It used to
  show «Не вийшло» over the domain error's English message, "The recording
  produced no words to work with." `noticeFor` turns `NothingWasSaidError`
  into a `silent` notice: «У записі немає слів» / «Не вийшло розпізнати
  мовлення. Спробуй записати ще раз.», en "No words in the recording" /
  "Vidlun couldn’t make out any speech. Try recording again." Only a take
  reaches it: the text screen's button is off while the field is blank.
  Every other failure keeps the layer below's message.
- **Topics are written with a space.** The model filed a birthday as
  «день_народження». `MoodEntry.create` turns underscores into spaces, so
  entries already saved that way read right and both spellings count as one
  topic in the week's themes and the patterns. The prompt now says a two-word
  topic is two words with a space.
- **Onboarding at large text** (owner's iPad screenshot). The app is
  iPhone-only, so an iPad shows it in a 375×667 window, and that iPad had the
  largest non-accessibility text size: the welcome's lede went under the
  button and the terms/policy pair ran off both edges. Reproduced on the SE
  simulator with `xcrun simctl ui <udid> content_size
  extra-extra-extra-large`. Now the wave mark gives way when the headline and
  lede would not fit with it (measured without it, so it cannot flicker
  back), the pair stacks when it is wider than the footer (it may still run
  12pt into the margin, as it always did on an SE at the default size), the
  onboarding headlines grow at most 1.1× («залишаються» broke one letter
  before its end at the hero's 1.2), and a scroller that still overflows
  flashes its indicator. At the default size the screens are unchanged.
- **The agreement line named a button that is not there.** It said
  «Натискаючи «Почати», ви погоджуєтесь… Політикою приватності» under a
  button reading «Далі», in «ви» where the app says «ти», and naming the
  policy differently from its link. Now «Натискаючи «Далі», ти погоджуєшся
  з Умовами використання та Політикою конфіденційності.»
- **Everything free for now** (owner's word: "збери поки білд де весь
  функціонал безкоштовний і поки сховай в секції Я секцію про підписку").
  `SELLING = false` in `container.ts` wires `EverythingFree`, a store that
  reports an active subscription and sells nothing, so every gate opens
  through the one entitlement it always went through: the month page, the
  week's topics and pattern, five-minute takes without the free minute's
  note. RevenueCat is not configured at all. The profile's subscription
  section is hidden behind `selling`. Selling again is that one line.
- **Build 53 carries the old legal texts**, as 52 did: the consent-release
  texts of c402a0a describe a consent screen and an "Entry analysis" switch
  the app does not have yet. They are held back in a commit of their own;
  `git checkout c402a0a -- legal/PRIVACY.uk.md legal/PRIVACY.en.md
  legal/TERMS.uk.md legal/TERMS.en.md` and `npm run legal` bring them back.

---

## 3ψψψ++. A take that waits for an answer, week arrows over empty weeks, no echo — 2026-10-30

- **Leaving a take is asked** (owner's word). The recording screen's Cancel
  is an X in the panel's top right corner, level with the label. Tapping it
  pauses the take and asks "Leave this recording?" in a system alert: Keep
  recording goes on into the same file, Leave throws it away.
- **Leaving the app pauses the take** instead of ending it (the 2026-10-29
  rule below is replaced). On coming back, the same alert asks, titled
  "Recording paused". The clock and the bars stop while the take is held.
  - `IAudioRecorder` gained `pause` and `resume`. A pause also turns the
    recording mode off: expo-audio restarts every paused recorder by itself
    when the app returns to the front (`resumeAllRecorders`), and only
    `allowsRecording: false` stops it. Checked on the simulator: the file
    stays at the same size while the alert is up and grows again after Keep
    recording.
  - The listener lives in `RecordingScreen`, not `App.tsx`, since it needs
    the alert. One alert at a time, so coming back while the X's question is
    up does not stack a second one.
- **Topics lock only when there are topics.** A week with no topics shows
  nothing there, rather than a lock over content that does not exist
  (`topicsSection`).
- **Week arrows skip empty weeks** (`GetWeekNeighbours`): back and forward go
  to the nearest week with entries, and back stops at the journal's first
  week.
- **Copy** (owner's word):
  - The line under the text being fixed ("Speech recognition may have
    misheard…", `detail.fixHint`) is gone.
  - Leaving the grounding exercise now reads "Хочеш завершити вправу? /
    Нічого страшного. Ти зможеш повернутися до неї в розділі «Я», коли
    захочеш." In English: "…anytime in the Me section."
- **The period calendar dots the days with entries** (owner's word), on
  "Your emotions".
  - Each day with an entry gets a small ink dot under its number, as a
    phone's own calendar marks a day with events. The dot is white on a
    selected end.
  - The days come from the history the screen already reads for the first
    entry (`entryDays`, keyed by local midnight).
  - Screen readers hear "є записи" / "has entries" after the date.
  - Fixed on the way: the grid wrapped after six days, so every date after
    the first week stood under the wrong weekday (seen 2026-09-27). It is
    now six rows of seven.
- **The entry page's date is US English** in English: "October 30 at
  12:37 PM", as in the journal, not "30 October at 12:37".
- **Vidlun no longer writes an echo for an entry** (owner's word). Gone with
  it: `WriteObservation`, `AttachObservation`, `IObservationWriter`, the
  Claude and fake writers, `OBSERVATION_MODEL`, and the capture hook's
  echo bookkeeping (the echo folded into a card or written into an entry
  saved before it landed). It was paid only, so free entries never had one.
  - Kept: `MoodEntry.observation` and the blocks that show it. Entries saved
    with an echo still show it on their page.
  - Still mentioning the echo: the processing title ("Складаю відлуння",
    "Writing your echo"), the fixed `compare.noneEcho` line under an "Echo"
    label when nothing was heard, the site (an entry-page section and the
    plan's list), the terms (observations on entries as part of the
    subscription) and the privacy policy (writing an observation as a reason
    to send words to Anthropic). The site, terms and privacy policy were
    rewritten the same day (below).
- **Legal texts after a legal review** (owner's word, 2026-10-30). They
  describe a consent screen and an "Entry analysis" switch the app does not
  have yet, so they go live with the build that adds them, together with
  the site and the worker.
  - Privacy policy:
    - The text sent to Anthropic is mental-health data, so it leaves the
      phone on explicit consent (GDPR Art. 9(2)(a); Ukrainian law Art. 7).
    - It now says what the model does with it, the difficult-state flag
      included, and how consent is withdrawn.
    - App Attest is described, with the key record kept 180 days. The worker
      now sets that TTL in `server/src/attest.ts`; it is not deployed yet.
    - Added: UK GDPR, the Ukrainian rights and where to complain, transfer
      bases, age 18+, and a US consumer health data section
      (`{#consumer-health-data}`, linked from the site footer).
  - Terms: 18+; the model named as Anthropic's Claude; US, UK and Ireland
    helplines and findahelpline.com; the paid list without echoes.
  - Site:
    - The privacy point now names Anthropic and consent, and a FAQ answers
      "who analyzes my entries".
    - The plan has no echo, and the footer links to the US section.
    - The four entry-page shots were retaken without the echo.
  - Both legal builders take `## Heading {#anchor}`: an id on the site,
    dropped in the app.
  - Still open: the provider's name and address (the owner keeps "the
    Vidlun developer" for now), the App Store age rating (to 18+), a
    processor agreement for the feedback inbox (consumer Gmail has none),
    and the consent screen, the switch and the crisis card in the app.

---

## 3ψψψ+. US English, the mood when choosing together, a take that ends with the app — 2026-10-27 and 29

- **The English copy, redone from the Ukrainian** (owner's request, 2026-10-27).
  Every interface string was checked against its Ukrainian source and 131
  rewritten in plain US English: the same word for the same thing (entry,
  journal, echo, topics, mood), buttons named for what they do ("Поділитись"
  is Continue, since Share means sending it to someone), and nothing the
  Ukrainian does not say. The microphone permission text was translated
  from the Ukrainian too; the old one promised "never uploaded".
  - 24 emotion labels changed. They stay adjectives, as English emotion apps
    use them. Cheeky (British) became Mischievous. Зневага, Образа and
    Неприйняття became Scornful, Offended and Not accepting. The two
    Embarrassed became Awkward (Ніяковість) and Uncomfortable (Незручність).
    No two current words share a label.
  - The transcript's quote marks were written into four screens as «…».
    They now come from `common.quoted`: «…» in Ukrainian, “…” in English.
  - Left for the owner, in the Ukrainian: the onboarding's legal line names
    a «Почати» button that is «Далі» and says «ви»; the microphone text says
    «міг/могла». The English names the real button, Next.
- **The mood when choosing together** (2026-10-29). The screen had no scale,
  so the mood the reading guessed was the one saved. It now carries the
  card's scale, and `whenMoodSet` writes the point into the draft and onto
  the card behind it.
- **Leaving the app ends the take** (2026-10-29), the way the stop button
  ends it. The listener lives in `App.tsx`: the capture hook must not import
  react-native, or the stage tests that run in plain Node stop parsing.
- **Chips are tighter** (2026-10-29): 6 and 12 instead of 8 and 15, with
  the hit slop keeping the touch area at 44pt.
- 1.6 was already on sale, so build 51 went up as 1.7.

---

## 3ψψψ. One plan, words that fit the sentence, a fresh home — 2026-10-23

Four things the owner raised from the phone, all for 1.5 (50):
- **"Розповісти про вчора" needed a relaunch.** Home worked out whether
  yesterday was empty only when it loaded, so a phone that kept Vidlun open
  across midnight came back with yesterday's answer. Home is read again
  every time the app returns to the front (`App.tsx`, next to the unheard
  entries).
- **The card offered contempt and judgement for a worry.** The words came
  off the chart alone, and worry sits at the same valence and energy as
  contempt, judgement, resentment and non-acceptance.
  - The reading now returns `nearbyEmotionIds`: other words from the list
    that fit what was said, so that with its own emotions there are eight.
    They are choices, never claims, and never reach the entry unless picked.
    They pass the same gate (known, current, not sensitive), and
    `Reading` carries them beside the draft.
  - The card offers what was heard, then those words, then fills from the
    chart, where the heard word's own branch now comes first.
  - Cost: about fifty more output tokens on the capture path. Not yet
    measured on the phone.
- **One plan.** The paywall sells the month alone (`planOnSale`): one card,
  no choice, no saving badge. The year and the lifetime stay configured in
  the store, and whoever bought one keeps it. The terms (effective 23
  October) and the site say one plan. Both had also still listed search,
  gone since 1.4, and now name the journal's emotion filter. The site was
  built but not deployed: until the RevenueCat offering drops the other
  two plans, the live 1.4 still sells three.
- **The locked topics on the week.** The paid card's shape (a ring and its
  rows, made up) sits under frosted glass with a paper veil. Over it is a
  lock in a solid circle and "Читати записи повністю ›". Seen in both
  themes. The locked pattern got the same (the owner's word, the same
  evening): four lines the length of two sentences under the glass, which
  runs out to the card's edges below "Що помітно", and "Відкрити патерн ›".
  One `LockOverlay` draws both.
- **1.5 was already on sale**, so build 50 went up as 1.6.

---

## 3ψψ++. The feedback sheet's words — 2026-10-20

The owner's word:
- **Body:** "Щось не так? Чогось не вистачає? Розкажи." / "Something wrong?
  Something missing? Tell us."
- **The field:** no placeholder words, only Feather's `edit-3` pen where the
  writing starts. It steps aside on the first letter, and the field reads
  as "Написати нам" to a screen reader. `feedback.placeholder` is gone.
- **Note:** "Нічого з твоїх записів не додається — ми отримуємо лише цей
  текст." / "None of your entries are attached — we receive only this text."
- The title "Написати нам" and the button "Надіслати" are unchanged.

The same day, the reminder sheet: its title "Нагадувати" became "Нагадати
про запис" / "Remind me to write", and its switch "Нагадувати щодня" became
"Повторювати щодня" / "Repeat every day".

And the bottom of "Я":
- **"Відновити з копії":** "Для нового телефона або після перевстановлення.
  Відкрий файл резервної копії — і записи повернуться у щоденник."
- **"Написати нам":** the hint is "Щось зламалося або чогось не вистачає?".
- **Language:** the choice gets the title "Мова" / "Language" (new key
  `profile.languageTitle`). It now sits in a card like the theme's, with
  the same soft track and a paper pill for the chosen one, where before the
  pills stood alone with no name.
- **Subscription:** with no plan the button says "Підключити" (it was
  "Оформити"). The status "Не активна" is unchanged.

And the top of "Я":
- **"Хвилина для себе":** the hint is now "…Нічого не записується й не
  зберігається."
- **"Нагадування":** when off, the row says "Вимкнено ›" where the time
  would be and has no hint. When on, it shows the time and "Щодня" as
  before. `Row` and `Heading` take an optional hint.
- **"Тема":** with "Системна" chosen, the hint reads "Визначається
  налаштуваннями телефону" instead of naming the current look, so
  `profile.themeNow*` is gone.
- **"Зберігати аудіо":** "Аудіозаписи зберігаються на цьому телефоні 13
  місяців. Потім видаляються автоматично. Текстові розшифровки
  залишаються."
- **"Резервна копія":** "Збережи свої записи, щоб не втратити їх під час
  зміни телефону." It no longer says the audio does not come along. That
  is still true, and the owner chose the shorter line.

All seen on the simulator.

---

## 3ψψ+0. The paywall's words — 2026-10-20

The owner's word, after keeping "Місячний наратив" earlier the same day:
- **Title and body:** "Твій місяць" — "Раз на місяць Vidlun збирає твої
  думки, емоції та теми в один підсумок." In English: "Your month" — "Once a
  month Vidlun gathers your thoughts, emotions and topics into one summary."
- **Plans:** "Місячна підписка $3.99 / місяць", "Річна підписка −47%
  $24.99 / рік, 7 днів безкоштовно", and "Довічний доступ $79.99,
  одноразовий платіж". The lifetime card lost its "без поновлення" note.
  The captions under the prices have no letter spacing, so "Довічний
  доступ" fits on one line.
- **The note under the plans, per plan:**
  - Yearly: "7 днів безкоштовно, потім $24.99/рік." and "Скасувати підписку
    можна будь-коли."
  - Monthly: "$3.99/місяць, поновлюється автоматично." and the same cancel
    line. The monthly plan has no free days, so it does not get the
    owner's "7 днів безкоштовно" template.
  - Lifetime: "$79.99 одним платежем — доступ назавжди." There is nothing
    to cancel, so no cancel line.
- **Restore:** "Відновити підписку" (was "Відновити покупку").
- **Links:** "Умови · Приватність", with the dot hidden from screen readers.

Seen on the simulator with each plan chosen.

---

## 3ψψ+. The active subscription's line — 2026-10-20

The owner's word: under "Підписка активна", the text now reads "Керування та
скасування — в App Store. Усе, що ти вже переглянув, залишиться тобі." The
English is "Manage or cancel in the App Store. Everything you have already
seen stays yours."

- "Місячний наратив" and its description stay. The owner had seen
  "Тижневий наратив" on an older build, was asked, and chose to keep the
  monthly title.
- "переглянув" is masculine. The owner chose it knowingly over the
  genderless "Усе вже переглянуте залишиться тобі", which goes against
  §7.9 of the brief.

---

## 3ψψ. The owner's flat list of emotions — 2026-10-20

The owner's word: the vocabulary is now the owner's list of 76 words, flat. Asked and
answered:
- **No levels.** Every word is on the same footing, and the card offers the
  8 nearest of all 76.
- **Old entries keep their words.** Nothing is rewritten.
- **"Неприйняття"** covers both "I don't accept something" and "I don't
  accept myself", depending on the situation. It is not sensitive.

What changed in the list:
- 72 words stay.
- 3 are renamed, labels only: Пустотливість → Пустощі, Приголомшеність →
  Приголомшення, Нервовість → Нервозність.
- 1 is new: `disgusted.nonacceptance` (Неприйняття / Non-acceptance,
  valence 2, energy 3).
- 50 leave and become `retired` in the data, among them "Погано", the
  compound branch except "Вигорання", Прийняття, Біль, Приємна втома,
  Полегшення після зусиль, Покинутість and Зрада.

In code:
- `Emotion.retired`.
- `isProposableByAi` excludes retired words.
- `EmotionVocabulary.current()` lists the words in use.
- `normalizeAiProposal` no longer lifts by confidence. `liftTo` and
  `Confidence.maxEmotionDepth` are gone, and a low-confidence entry is still
  flagged for review.
- The analyzer's prompt lists only current, non-sensitive ids, and its
  "different branches" and "broad over specific" lines are reworded.
- The card offers any current word, not only levels 1–2.
- With no reading, the card offers the six old roots still in the list.
- A typed retired word becomes the person's own word.
- "Твої емоції" lost the refinement block and the dark prose panel, and
  `GetVocabularyGrowth` keeps only `counts` and the period.
- CLAUDE.md §5 regression 3 and the §6 depth rule record the change.

Still to do:
- The site says "Словник зі 125 емоцій". Change it to 76 when 1.4 ships,
  since 1.3, with 125, is the version on sale.
- The 1.4 store shot of "Your emotions" shows words that are all still in
  the list.

Seen on the simulator: the card offers Задоволення, Оптимізм, Ніжність,
Гордість, Вдячність, Радість, Впевненість, Пустощі. The owner's month-ago
card still shows the retired "Полегшення після зусиль".

---

## 3ϋ++. The month-ago card stands apart — 2026-10-15

The owner's word: on home, "Місяць тому цього дня" blended into the entry
cards under it. It had a border and no fill, which made it look like one
more entry. Now:
- it is filled with `accentSoft` and has no border;
- its caption is in `accentInk`;
- the old entry's words are quoted («…»), as on the entry page.

The accent means Vidlun speaking, and this card is Vidlun bringing a day
back. The year-ago card (`YearEchoCard`, ink border) is unchanged. Seen on
the simulator in both themes with the Ukrainian demo journal.

---

## 3ϋ+. The week screen's words — 2026-10-14

The owner's word, the same evening:
- **Title:** "Твій тиждень" / "Your week" (new key `stats.yourWeek`), with
  the dates under it in `PeriodHeader`'s second line. Until now the dates
  were the title (since 2026-09-22).
- **Captions:**
  - "Настрій по днях" → "Емоції по днях" / "Emotions by day".
  - "Помічений патерн" → "Що помітно" / "What stands out".
  - "Про що ти говориш" → "Про що був твій тиждень" / "What your week was
    about".
- **No pattern:** "Цього тижня твої записи були різними — спільної
  тенденції не видно."
- **The unpaid topics link:** "Читати повністю" → "Читати записи повністю".

Seen on the simulator with the owner's journal (a week with one entry).

---

## 3ϋ. The pattern names days and emotions, and opens them — 2026-10-14

The owner's word, in two steps the same day.
1. **No average of moods.** The person never sees a number on the scale, so
   the pattern counts its words: "Добрий"/"Високий" (4–5) and
   "Низький"/"Дуже низький" (1–2). "Рівний" sits on neither side.
2. **Two kinds of sentence, plus a button.** The owner found "у записах із
   «кава» настрій здебільшого добрий: 3 з 3" uninformative and chose these
   two from the options offered:
   - **From the days to the topic.** Take the month's hardest days (any
     entry low or very low) or its best (any entry good or high). The
     pattern names the topic on most of them, provided it sits on a third
     more of them than of the month's other days. Days, not entries; three
     on each side at least; hardest first on a tie.
     Example: "Вересень: усі 3 найважчі дні — з темою «робота»."
   - **From the topic to the emotion.** Name the emotion on most of a
     topic's entries, provided it is a third more common there than
     elsewhere. The first sentence's topic is preferred ("Поруч із цією
     темою найчастіше звучить «Втома»: 4 з 5 записів"). Otherwise any
     topic qualifies: "Поруч із темою «прогулянка» найчастіше звучить
     «Спокій»: 2 з 3 записів."
   - **"Подивитися ці дні ›"** (or "ці записи" for an emotion sentence
     alone) opens the journal on exactly those entries. A chip above the
     list names them, e.g. "Найважчі дні · «робота»", and its X brings back
     the whole journal. The journal tab and the emotion filter clear it as
     well.
- The month is named in the sentence ("Вересень: …"), because the week on
  screen can belong to an earlier month than "this one".
- The tag stays in the nominative inside quotes, after "з темою", because
  tags cannot be declined automatically.
- **Code:** `MoodPattern` is now `DaysPattern | CompanionPattern`, both
  with `entryIds`. `JournalFocus` lives in `journalFilter.ts` and in the
  flow as `journalFocus`. The `stats.patternHigher/Lower` and
  `stats.times*` keys are gone. Still paid; the unpaid card is unchanged.

Seen on the simulator with the Ukrainian demo journal:
- The 5–11 Oct week shows "Поруч із темою «робота» найчастіше звучить
  «Втома»: 3 з 5 записів."
- The 28 Sep – 4 Oct week shows both sentences.
- "Подивитися ці дні" opens the three entries, and the chip's X brings back
  all 39.

The 1.4 store shot 06-week still quotes the old sentence. Retake it before
1.4 goes to review.

---

## 3ϊ. No Face ID lock — 2026-10-13

The owner's word, for 1.4: the journal no longer locks.
- **Gone:** the "Face ID" row on "Я", the locked door with its relock after
  a minute away, `IScreenLock`, `BiometricScreenLock`, the `appLock`
  setting, and the `lock.*` and `profile.appLock*` copy. A phone that had
  the lock on in 1.3 opens straight into the journal, because a stored
  `appLock` is no longer read (there is a test for this).
- **The privacy policy** drops its Face ID permission line in both
  languages, and the in-app JSON is rebuilt. The effective date stays
  1 October.
  - vidlun.app still serves the old text, which is right while 1.3 (with
    the lock) is the version in review.
  - Redeploy the legal site when 1.4 ships.
- **The library went too** (owner's word, the same day):
  `expo-local-authentication` is uninstalled, and `NSFaceIDUsageDescription`
  is gone from app.json and from the built Info.plist. `pod install` dropped
  ExpoLocalAuthentication before build 48.

Seen on the simulator: "Я" goes from "Зберігати аудіо" straight to
"Резервна копія".

---

## 3ω. No search tab; the journal filters by emotion — 2026-10-13

The owner's word, for 1.4:
- **The search page is gone.** That means the tab (the bar has three now),
  `SearchScreen`, the `search` stage, the `SearchEntries` use case with its
  test, and the `search.*` and `tab.search` copy. Finding an entry by a
  word in its text goes with it.
- **The journal's header has a filter button**, a round 44 pt control with
  Feather's `filter` beside the count. It opens a sheet (`EmotionFilterSheet`,
  a `ModalSheet`) holding every emotion on the person's entries, the most
  used first. The chips are picked there, and "Показати" narrows the
  journal to the entries that hold any of them.
  - The sheet has no "Скинути" (the owner took it out the same day). A
    second tap lets a chip go, "Показати" with nothing picked shows every
    entry, and closing the sheet changes nothing.
  - The quick way out is under the title instead (owner's word, the same
    day). While a filter is on, its emotions sit there as chips, each with
    an X that drops just that one, followed by "Скинути", which clears the
    filter in one tap.
  - While a filter is on, a badge on the button says how many emotions it
    holds (owner's word, the same day; the button stays outlined so the
    badge reads). The count pill shows the filtered count, and the
    milestones step aside.
  - The filter lives in the flow (`journalFilter`). It survives opening an
    entry and coming back, and it clears when the journal is opened from
    the bar.
- `journalFilter.ts` holds the two pure parts, `emotionsUsed` and
  `entriesWithAny`, with a test. `EntryCard` lost `showEmotions`: with
  search gone, every card shows its words.

Seen on the simulator: three tabs, the sheet, "Спокій" + "Тривога" giving
five entries, and the filter kept after opening one of them.

---

## 3ψ. "Твої емоції" counts the emotions; the journal says which entries have audio — 2026-10-13

The owner's word, for 1.4:
- **"Твої емоції" shows how often each emotion came up** in the chosen
  period, the most frequent first, with a bar against the most frequent
  one and the number of entries. "Вперше цього місяця" and "ті самі слова,
  що й раніше" are gone (`firstTimeIds` and five copy keys with them).
  - `GetVocabularyGrowth.counts` reads `emotionIds`, the words on the
    journal's cards, unlike the rest of the use case, which measures the
    person's own vocabulary from `selfEmotionIds`. An entry counts once
    per emotion.
  - At the same count, the emotion named most recently comes first.
  - The trades for a finer word and Vidlun's sentence about them stay
    under the bars, each shown only when there is one.
  - The bars wear `emotionTint`, which is the one blue for every word
    since the identity change.
- **The journal's cards carry a microphone beside the time**: `mic` when
  the entry still has its audio, `mic-off` when it does not. The answer
  comes from the files (`IRecordingStore.withAudio`, `FindRecordedEntries`),
  not from `source`, since a voice entry can outlive its audio. No icon
  until the files answer, and search results show none.

- **A quiet week on the stats screen has no "На головну" button** any
  more; the back arrow above goes home. `stats.toHome` is gone. Its line is
  shorter too: "Цього тижня записів ще немає." / "No entries this week
  yet.", like the past week's "Того тижня записів немає."

Seen on the simulator: the bars for October, both icons in the journal,
and the quiet week without its button.

---

## 3χ. Captions and words on the entry page, the delete dialog, the empty journal — 2026-10-12

The owner's word, for 1.4:
- **The entry page.** The emotions get a caption, "Емоції" / "Emotions"
  (new key `entry.emotions`), shown only when there are emotions; with
  none, the "Vidlun не почув емоції" box stays as it was. The date at the
  top is semibold in ink instead of faint.
- **"Теми" / "Topics"** replaces "Про що говорили" / "What it was about".
  `entry.topics` is one key, so the question card, the compare card and
  the entry chips say "Теми" too.
- **The delete dialog** keeps with "Залишити" instead of "Лишити".
- **The empty journal** says "Тут поки порожньо" and "Розкажи, як минув
  твій день." ("Nothing here yet", "Say how your day went.").

Seen on the simulator: the date, the caption, and the dialog's button.

---

## 3φ. The question card without "more precisely?" — 2026-10-07

The owner's word, after seeing "точніше?" on the site's step-2 shot: no
sub-groups on the card, the offered words and nothing under them. A tap on
an offered word chooses it and a second tap lets it go. `Refinement`,
`onRefine`, `refineOwnWord` and `edit.refine` are gone.

What it costs, offered to the owner:
- **Third-level words are typed now.** The card offers the first two levels
  (`emotionsNear`, unchanged), so "Надія" or "Натхнення" come only through
  "+ Додати емоцію". The month's "ти уточнюєш" line counts them the same
  way, so it may read lower.
- **No reading leaves seven broad words.** `wordsWithoutReading` offers the
  roots of the wheel only; they used to open their own children.
- **Sensitive words.** §6 bars the analyzer from proposing them, and the
  drill-down was one way to reach them. Typing is the way now:
  `idForTypedWord` turns a typed label into the vocabulary's own word, the
  sensitive ones included. CLAUDE.md §6 says so.

The same day: the site's step 2 dropped "уточни" / "go more precise", and
its four shots show one chosen word. Seen on the simulator: a second tap
on "Оптимізм" lets it go, nothing opens.

It goes out with 1.4 (owner's word): 1.3 stays in review with build 45,
which still has the row, and its description keeps "go more precise" to
match. Build 46 is 1.4. The 1.4 description drops the phrase: "pick one
or several, or add your own". When nothing was heard, the card keeps the
seven broad words (owner's word).

---

## 3υ. The month card closes; where do past months live? — 2026-10-06

The owner's word: the home card "Твій вересень" seemed always there, so it
gets an X. It is not always there: `GetMonthSummary.isFresh()` shows it
in the first seven days of a month, about the month before, when that
month held three entries or more; on the 8th it rests until the next 1st,
when "Твій жовтень" takes its place.

- **The X** sits in the card's top corner (`TapTarget`, the glyph at the
  kicker's 60%) and stores the month as `Settings.monthCardClosed`
  ("YYYY-MM", validated on read, `null` by default). Only that month's
  card stays away, across launches; the next month's card comes on its
  own. Seen on the simulator: closed, gone, still gone after a relaunch.
- **Open, asked by the owner**: "де можна почитати всі місяці?" Nowhere
  yet. The month's page opens only from that card, only that week, and
  only for the month just ended; once the week is over, or the card is
  closed, a paid narrative the person already has (it is cached per
  month) cannot be reached.
- **"Твої місяці"** (owner's word, the same day): a button on the stats
  screen under "Твої емоції" — both now stand under any week, a quiet one
  too, so a Monday with nothing in it does not hide them — opening
  `MonthsScreen`: every finished month with three entries or more, newest
  first, as "Вересень 2026 · 23 записи" (`GetPastMonths`, tested). A
  month opens its page through the same road as home's card
  (`GetMonthSummary` takes `month`; without the narrative, the plans), and
  that page's back arrow returns to the list (`month.from`). A month from
  another year says its year in the kicker ("Твій вересень 2025").
  Walked on the simulator both ways: without access a month leads to the
  plans; with it, to the month's prose and back to the list.
- **The search field** says "Пошук" / "Search" (`search.placeholder`, was
  "Слово з речення" / "A word from a sentence"), owner's word, same day.

**1.3 (45)** carries §3τ and §3υ on top of 44, uploaded 2026-10-06 18:09
EEST. The helpline number in it is the owner's as given and still
unconfirmed by a public source (§3τ): it must be checked before 1.3 goes
to review.

---

## 3τ. Grounding on pages of its own, in new words — 2026-10-06

The owner's word: the offer sat under "Збережено", a screen that leaves by
itself, so it moves to a page of its own after it; the copy is the owner's,
line for line.

- **"Збережено" always leaves after its beat** (`SavedScreen` takes one
  `onDone`). After an entry flagged distress it hands over to the
  grounding stage instead of home, and `GroundingScreen` opens on the
  offer: "Є хвилина для себе?", "Спробуй помітити, що зараз навколо тебе.
  Це коротка вправа на заземлення — нічого не записується й не
  зберігається.", "Спробувати", and an X top right in place of "Не
  зараз".
- **The steps** close with the X (`SheetClose`) in place of "Вийти":
  "Озирнися навколо." / "Прислухайся." / "Відчуй." (the owner's third had
  no full stop; it got one, like the other two), each with its own hint
  ("Знайди 5 речей, які бачиш. За кожну — торкнися кружечка." and so on,
  `ground.hint1–3` for the shared `ground.hint`). Whispering is no longer
  mentioned: the exercise only ever counted taps.
- **The last page**: "Готово 💛", "Зроби ще один повільний вдих і видих.",
  "Ти можеш повертатися до цієї вправи щоразу, коли хочеться трохи
  зупинитися й побути в моменті.", and "На головну". The "nothing is kept"
  line moved from here to the offer, before the exercise starts (M8 put it
  on the closing screen; the owner put it first).
- **A helpline on the last page for a phone in Ukraine**: "Якщо тобі зараз
  потрібна підтримка, ти можеш звернутися на гарячу лінію UA Mental Help:
  0 800 331 200. Безкоштовно та конфіденційно." In Ukraine means the
  phone's region is Ukraine or it keeps Kyiv time (`inUkraine`, read when
  asked through `Container.inUkraine`); the number dials on a tap.
  **The number is unconfirmed**: on 2026-10-06 no public source listed
  0 800 331 200, UA Mental Help appeared with social channels only, and the
  nearest listed number was the Red Cross's "Поговорімо" line, 0 800 331
  800. It waits on the owner to be checked before a build carries it.
- **A way in from "Я"** (owner's word, the same day): the first row there,
  "Хвилина для себе" / "Коротка вправа на заземлення. Нічого не
  записується." / "Почати" (copy not the owner's; open to change). It
  opens on the first step, not the offer, since the person asked for it;
  the stage remembers where it came from (`from: 'saved' | 'settings'`),
  so the X goes back to "Я" from there and home after a hard entry, and
  "На головну" always goes home. The last page's promise now has a door.
- **"1 з 3"** in place of "перше з трьох" (owner's word): one key,
  `ground.progress` = "{{n}} з {{total}}" / "{{n}} of {{total}}", set
  without the caption's capitals and tracking.
- **The steps' look is open**: the owner finds the column of circles
  unclear (nothing says it is tapped) and too empty, and asked for
  animation and a few options. Three playable variants on the canvas
  "Варіанти заземлення" (claude.ai/artifact/SnUxRDKTGaFdPdicDQeM5R),
  beside the current screen: A, a breathing circle with the sense's glyph,
  progress dots and a button named for the act ("Бачу" / "Чую" /
  "Відчуваю", present tense and so genderless); B, the ring as the button,
  segments sweeping in, the count inside; C, one concrete prompt at a time
  ("Щось велике", "Найтихіший звук", "Що під ногами") over the same
  button.
- **The owner picked B**, without "Пропустити крок" and without the
  sense's glyph in the centre, and with the count's two halves closer in
  size ("0 з 5" on one line, 44 and 26, the second in `inkSoft`; the canvas
  had 52 over 14). Built in `GroundingScreen`'s `Ring`: 268 pt, one arc per
  thing (16 pt, 10° apart), the inner disc on `paper`; it breathes (1 to
  1.03 over 6 s), a tap sends out an `accent` ripple, sweeps the next arc
  in along its own length (`strokeDashoffset`, 550 ms) and ticks the hand
  (`IHaptics.notice`, the selection feedback: the eyes are on the room);
  a full ring turns `solid` with a tick mark and the next step follows
  1.5 s later. Reduce Motion stills all of it. The hints say "торкнися
  кола", and the steps have no "Далі" any more (`ground.next` removed):
  M8's "skip is always available" still holds, since nothing checks what
  was noticed and the X is always there.
- **Leaving asks first** (owner's word, the same day): the steps' X opens
  "Вийти з вправи?" / "Повернутися до неї можна будь-коли в «Я»." with
  "Залишитися" (cancel) and "Вийти", neither in red. The offer's X and the
  last page leave without asking: declining an offer should cost nothing.
- **Green, not ink** (owner's word, the same day): the filled arcs, the
  full centre and the ripple are `calm` (#6F9B00, #AFD64A at night). Lime
  stays the record button's alone; `calm` already means the good end of
  the mood scale, and a calm minute is the nearest thing to it. The tick
  on the full centre is `onSolid`, which flips with the theme and reads on
  both greens.
- The simulator's pretend analysis gained a fifth reading, overwhelmed and
  flagged distress, so the whole path can be walked there: every fifth
  reading after a launch, a correction of the wording counting as one.

---

## 3σ. The mood in one line, the feedback sheet's X, the subscription last — 2026-10-01

The owner's word, item by item.

- **The entry page's mood** is one line, "НАСТРІЙ ● Високий", with no card
  around it: the card gave one word the room of a paragraph. `MoodLine`
  puts its caption beside the word instead of over it; the entry page is
  its only user.
- **"Написати нам"** closes with the X top right (`SheetClose`, as on the
  reminder and period sheets) and lost "Не зараз" under its button
  (`feedback.cancel` removed); the backdrop still closes it.
- **The subscription card is the last thing on "Я"**, under the language
  switch, named "Підписка" / "Subscription" (`subs.name`, was "Підписка або
  разова покупка"). The way in is a whole-width button under the name and
  the status, not a pill beside them: "Оформити" / "Subscribe" while there
  is no plan (`profile.subscribe`), "Керувати" / "Manage" once there is
  (`profile.manage`); `profile.open` is gone. The owner weighed
  "Активувати" against "Купити" and left it open: "Оформити" is the
  paywall's own verb for a plan ("Оформити за …"), where "Купити" promises
  a charge from a tap that only opens the plans, and "Активувати" promises
  something already there to switch on. Under the new name the paid status
  reads "Активна" / "Active" (`subs.statusPaid`, was "Підписка активна").
- App Review once could not find the purchases (1.0, 2.1(b)), so the 1.3
  review notes must point at the new place: "Я", the last card,
  "Оформити".
- **The plans screen** lost its closing sentence, "Це єдине платне тут." /
  "It is the only paid thing here." (`subs.body`); what stays says what the
  month's piece is. Nothing else became paid: the rule that only the
  narrative is (CLAUDE.md §9) stands, it is just no longer said there.

**1.3 (44)** carries §3ρ and §3σ on top of 43, uploaded 2026-10-01 17:58
EEST.

---

## 3ρ. The topics on the question card, and a stub that names some — 2026-10-01

The owner asked where the topics had gone ("якщо про роботу, то тег має бути
робота"). They never left the entry: Haiku still names up to three, they
are saved with it and shown on the entry page, on "choose together" and in
the week's themes. But since "next" saves at once (§3ε), someone who names
a feeling never saw them while recording, and in the simulator there were
none at all — the pretend analysis returned an empty list on purpose.

The owner's word, the same day:

- **The topics sit on the question card, under the transcript** inside the
  quote card, captioned "Про що говорили" (`entry.topics`), as grey chips
  with the remove mark. A tap takes one off; it stays, faded, as "+ topic",
  and the same tap puts it back. The card is now the one place a wrong
  topic can be taken off: the edit screen that could went with "Не зовсім".
  `TurnStage.droppedTopics` holds what was taken off; `cardAfterAnswer`
  saves the entry without those, and Vidlun's proposal keeps all of them.
  A correction keeps them off, like the named words. Unheard entries have
  no topics, so no row.
- **The stub names topics from a short dictionary, in their dictionary
  form.** Its first version took the last long words as written, and the
  owner saw "спортзалі" on the card where "спортзал" belonged (same day):
  the real reading is told to write the nominative, and the stub could not
  decline a word. `fakeTopics.json` lists some fifty topics, Ukrainian and
  English, each with whole words (for short ones, where a beginning would
  catch others: "сон" must not find "сонце") and beginnings of words
  ("робот" for every case of "робота"). The longest sign wins ("workout"
  is the gym, not work), a word it does not know names nothing, and three
  at most come back, in the order said. The Ukrainian lives in that data
  file rather than in code, so the English-only rule for code holds; it is
  the one file in `src/` outside `src/i18n/` with Ukrainian in it, and only
  the simulator reads it.
- CLAUDE.md §9 no longer forbids the reading on the card; what is left of
  the rule is the observation.

---

## 3π. The period sheet closes with an X, and build 43 — 2026-10-01

The owner's word: the period sheet gets the reminder sheet's X top right
(`SheetClose`, shared by both from `ModalSheet.tsx`) and loses "Скасувати"
under its buttons; the backdrop still closes it. Seen on the simulator: the
X beside "Показати за період", and it closes the sheet.

Build 43 carries everything since build 42: §3β through §3π, the
text-slack fix of §3δ included. It went up as **1.3 (43)**, uploaded
2026-10-01 16:35 EEST: the first try under 1.2 was turned away (ITMS-90186,
ITMS-90062) because 1.2 is released and its train is closed to new builds,
and 1.3 was already waiting in App Store Connect (PREPARE_FOR_SUBMISSION).
The number 43 was never accepted, so it stayed.

---

## 3ο. Emotions instead of a vocabulary, a quieter statistics screen, the reminder sheet — 2026-10-01

The owner's word, item by item.

- **The entry page** lost its footnote "Vidlun описує сказане й не дає
  порад, оцінок чи медичних висновків." (`detail.disclaimer` removed). The
  same statement stays in the terms, §2.
- **"Твій словник" is "Твої емоції"** / "Your emotions" (`dict.title`), with
  no purpose line under it ("Скільки різних слів…", `dict.purpose`), no
  "Різних слів: жовт. 5" line (`dict.perMonth` and its `monthsLine`) and no
  "Дивитися тиждень" button (`dict.seeWeek`); the round back arrow still
  returns to the week.
- **Statistics:** the "11 записів" count under the chart is gone (`Count`,
  `stats.weekCount*`; the plural test now checks `feed.entry`), and the
  "твій словник →" link is a secondary button "Твої емоції".
- **Deleting an entry asks** "Видалити цей запис?" over "Ви впевнені? Весь
  зміст картки буде видалено." (`delete.body`; English "Are you sure?
  Everything on this card will be deleted."). The owner's wording is formal
  "Ви" where the rest of the app says "ти" — kept as written, raised.
- **The reminder sheet:** titled "Нагадувати" / "Remind me", with no line
  under it ("Вечір, коли ти зазвичай уже нікуди не йдеш", `time.body`); an X
  top right (`common.close`); "Зберегти" / "Save" instead of "Готово".
  **Closing no longer saves:** the X, the backdrop and the system's back
  leave the setting as it was, and only "Зберегти" keeps the draft — with a
  save button on the sheet, closing it is not agreeing to it.
- **Every sheet dims the screen more.** One `scrim` token (60% near-black on
  light, 70% black on dark) on all four: the reminder and period sheets had
  no dimming at all, the milestone and feedback sheets 42%. `ModalSheet`
  (unused until now) carries the two Modal sheets: the Modal fades, so the
  backdrop darkens in place, and the card rises on its own (still under
  Reduce Motion). `Sheet` fades its scrim in with the card.

Seen on the simulator: statistics without the count and with the button;
"Твої емоції" with the words alone; the period sheet dimmed; the reminder
sheet with its title, X and "Зберегти", the X leaving "Вимкнене" as it was;
the entry page without the footnote; the new confirmation, answered
"Лишити". The period calendar still leaves Sunday empty and wraps
(2026-09-27's bug 2). Not in build 42; goes with the next.

---

## 3ξ. The splash is the name alone — 2026-10-01

The owner's word: the splash shows "Vidlun" and nothing else — no circle,
no animation.

- **`SplashOverlay`** lost the halo that circled while the journal opened
  and the three echo dots that arrived one by one; the wordmark image sits
  centred on the canvas, still the same pixels as the phone's launch image.
  What stays: the "couldn't open" line with its retry after five seconds,
  the 1.2-second minimum, and the crossfade into the screen underneath when
  it leaves (a screen change, not the splash moving; say if that goes too).
  `DOTS_SPAN` and the dot constants are gone.
- **The launch image is centred too.** It sat 18.25 pt left so the word
  held still when the dots joined it; with no dots the JS splash centres the
  word, and an offset launch image would make it jump right at the handoff.
  `scripts/generate-splash-assets.sh` now takes the offset out (it used to
  put it in), and `ios/Vidlun/SplashScreen.storyboard` was patched in place;
  it compiles with `ibtool`. Takes effect with the next native build.
- **Not seen on the simulator for the native half:** this Debug build shows
  a white launch screen before the bundle with the old storyboard and the
  new one alike, so the launch image can only be judged on a real build. The
  JS half was seen: "Vidlun" alone, centred, then the crossfade to home.
  Not in build 42; goes with the next.

---

## 3ν. The week's prose is gone; the narrative is the month's — 2026-10-01

The owner's word: "Твій тиждень" said what "Твій вересень" says, so the
weekly narrative goes, and with it the month's card on the statistics
screen — the month lives on home alone.

- **The week is days and counts.** `GetWeekSummary` lost its narrative
  generator, `withNarrative` and `narrative`; the statistics screen lost the
  "Твій тиждень" panel and its lead ("Vidlun напише про цей тиждень…"), the
  "too few entries" line and the subscription button inside it. It is now
  the dates, mood by day, the count, the pattern card, topics and the
  vocabulary link. Patterns were already read over the month.
- **The month card left the statistics screen** (and the month's own
  locked lead "Vidlun напише про цей місяць…" with it). Home's month card
  now opens a page of its own (`MonthScreen`, stage `month`): the card's
  two lines, then the prose — "Пишеться…" with ghost lines while it is
  written, the paragraphs after; a failure goes home with the usual line.
  Without access the card goes straight to the plans, since the prose is
  the paid half.
- **One narrative in code:** `ClaudeNarrativeGenerator` has the month's
  prompt only (no `NarrativeSpan`; the prompt version stays 2, the month's
  text unchanged), and `CachedNarrativeGenerator` files rows by month only.
  Weekly rows already stored under `vidlun.narrative.<y>-<m>-<d>` are no
  longer read; nothing deletes them.
- **Copy says month:** the plans screen is "Місячний наратив" / "The
  monthly narrative" and "Раз на місяць Vidlun пише…"; the empty pattern
  card says "Цього місяця нічого не повторювалося. Патерни трапляються не
  щомісяця…". Retired: `stats.yourWeek`, `stats.proseLater`,
  `stats.narrLockedLead`, `stats.narrLockedAction`, `stats.monthLockedLead`.
  The trial lines ("Пробний тиждень триває") are about the free trial, not
  the narrative, and stay.
- **Terms and privacy (source and in-app copies) say month**, with the
  effective dates moved to 1 October 2026; the privacy table names the
  weekly texts earlier versions stored. **The landing's paid list** says
  "Місячний наратив". Neither is deployed: the pages.dev site still shows
  the weekly wording until the owner says to redeploy, and the dates should
  match the day the new terms actually go out.
- **For the simulator:** `EXPO_PUBLIC_FAKE_ANALYSIS=1` also swaps in
  `FakeNarrativeGenerator`, a pretend month marked as such and wired without
  the cache, so the month page can be walked with
  `EXPO_PUBLIC_FAKE_PURCHASES=active`.
- **Overruled in CLAUDE.md:** §2 "Sonnet for weekly summary", M5's
  "paywalled weekly narrative", and the BACKLOG M5 notes that sell the
  week.

Seen on the simulator: statistics free and paid with no week panel and no
month card; home's month card → the plans (free) and → the month page,
writing then the pretend text (paid); the plans titled "Місячний наратив".
Not in build 42; goes with the next. App Store Connect's subscription
description and screenshots may still sell the week — not in the repo.

---

## 3μ. The stats screen: dates for every week, home's month card — 2026-10-01

The owner's word.

- **Every week is its dates.** The title read "Цей тиждень" with the range
  under it; now it is the range itself ("28 вер. – 4 жовт."), as earlier
  weeks already were, with nothing under it (`stats.title` removed). The
  count under the chart says only "13 записів" — "цього тижня" is gone from
  `stats.weekCount*`, which also ends 2026-09-27's bug of "this week" on an
  earlier week.
- **The month card opens as home's does:** "Твій вересень" as the small
  kicker over "Подивись, яким він був." (home's own keys), in home's
  measures (20/22 padding, 21-pt lead), then the month's text, the writing
  ghosts or the locked lead as before. `stats.monthLabel` ("Місяць") and
  `stats.monthTitle` went.

Seen on the simulator (after Metro had stopped again and was restarted).
Not in build 42; goes with the next.

---

## 3λ. The entry count moved to the journal — 2026-10-01

The owner's word: the profile ("Я") lost both of its tiles — the entry count
went to the journal, and the run of days already shows on home. The journal
puts the count opposite its title as the same pill home uses for days
(`CountPill`, shared now; `StreakPill` folded into it), absent at zero, and
the "N записів · <month>" line under the title is gone with `feed.summary`,
so the count is not said twice. `openSettings` no longer reads the journal
just to count it; the `profile.entries*` and `profile.streak*` keys went too.

Seen on the simulator: the profile opens on the subscription row; the
journal reads "Щоденник" with "• 28 записів" beside it. Not in build 42;
goes with the next.

---

## 3κ. One blue for feelings, the mood's colour for entries, the mood on the card — 2026-10-01

The owner's word, from a screenshot of "Поганий день…" offered pleasant words.

- **Those words were the pretend analysis, not the matching.** In the
  simulator `FakeReflectionAnalyzer` ignores the text and goes round
  pleasant → hard → mixed → ordinary per entry from launch; the first entry
  after a relaunch is always pleasant. The same sentence as the second entry
  got the hard side (Біль, Втома, Відкинутість…), as `emotionsNear` is
  tested to do. Real readings need the phone.
- **The card:** the box of named words lost its "Твій вибір" caption
  (`turn.chosen` removed; the box stays on top); "+ Своє слово" is
  "+ Додати емоцію" / "+ Add an emotion"; the typed field has no placeholder
  (`turn.ownWordPlaceholder` removed).
- **The mood is set on the card.** A compact scale (the old `MoodScale`
  without end labels) under "+ Додати емоцію", "Настрій" and the mood's word
  in its colour above it; Vidlun's reading comes already chosen, one tap
  changes it. `TurnStage.mood` holds the person's point (null until touched)
  and every save takes it — the named answer, choosing together and an
  unheard entry. The choose-together list lost its mood block. ConfirmEntry
  now logs a revision when the saved mood differs from Vidlun's reading
  (not when Vidlun read none), since nothing marks such an entry revised.
- **Feelings in one blue, entries in their mood's colour.** New token `tag`
  — the drawing's own blue, the one it fixed for "lonely" (#2E7DE9 /
  #6BAEFF) — for every emotion chip and emotion name, a word of the
  person's own included (it was ink). `emotionTint` returns it; the palette
  derivation in `emotionColor.ts` is drawn nowhere now, kept with its tests.
  Entries are marked by mood (`moodTint`): the dot on home, journal and
  search rows and on the echo cards, and the week strip by the day's average.
  One mapping for mood colour — `toneFor`, now in `emotionTone.ts`, the
  scale's bands (1–2 terracotta, 3 amber, 4–5 green); the mood line on the
  entry page had its own copy, which coloured "Низький" amber.
- **The saved entry's page:** no "Виправити текст" (and `fixEntryWording`
  gone), which also settles §3θ's open question — the plain card now shows
  only when a save fails. "Видалити запис" is a red bin icon top right (new
  token `danger`, #D93A2E / #FF6B5F), still asking first; the journal's
  swipe-to-delete is the same red instead of the low mood's terracotta.
- **Overruled in CLAUDE.md:** §7.1 "Emotion colour is derived, never
  assigned", and §9's "no part of Vidlun's answer before the person's — that
  includes … the mood".

Seen on the simulator: the card in blue with the mood scale at "Високий",
moved to "Низький", "Безсилля" typed in blue on top, saved — home marks it
terracotta with "Безсилля" in blue, the page shows the red bin, no fix
button and "Низький"; the week strip by mood; the same sentence again → the
hard side and "Низький"; choosing together in blue with no mood block. Not
in build 42; goes with the next.

---

## 3ι. What was named sits on top, in its own section — 2026-10-01

The owner's word: on the question card the chosen words, in a row right
under the offered ones, read as more of the list. They now sit above it, in
a bordered paper block captioned "Твій вибір" / "Your choice" (new key
`turn.chosen`), shown once something is chosen; a word typed through
"+ Своє слово" lands there too, and the field itself stays under the
offered words, as the way out when none of them fits. The offered words
keep their own state (a chosen one fills faintly) and their drill-down into
children. The cost, named when the row was first put underneath: the list
moves down when the first word goes in.

The choose-together list is untouched: there the person's words from the
card still lead the one list under "Vidlun почув". Offered to the owner.

Seen on the simulator: one word chosen → the section appears with it; a
second word and "Тиша всередині" typed in join it. Not in build 42; goes
with the next.

---

## 3θ. One way on from the card, and the text screen reworded — 2026-10-01

The owner's word, answering §3η's two questions and adding the text screen.

- **The plain card says "Зберегти" and nothing else.** `reflection.confirm`
  is now "Зберегти" / "Save" and serves both cards (`compare.save` folded
  into it); "Не зовсім" is gone. With it went the only way into the edit
  screen, so the edit path is removed whole: `EditScreen.tsx`, the
  `editing` stage, `beginEditing`, `applyEdits`, the hook's `reviseEntry`
  and fourteen `edit.*` keys (`edit.refine` stays, the palette uses it).
  `ReviseEntry` itself stays in the application layer and the container,
  tested and unwired. Two of 2026-09-27's bugs went with the screen: the
  gendered "Що ти сказав" caption and the edit that kept the old reading.
  Nothing marks an entry `wasRevisedByUser` from the app any more, so the
  revision log now receives only disagreements; the proposal and the kept
  words are both still on every entry.
- **The plain card is now reached only** when a save fails, and after the
  text of a saved entry is corrected on its page. In the second case
  Vidlun's new reading replaces the entry's words — the person's own
  included — and the card has no way to change them or to step back.
  Raised with the owner; routing that re-read through the choosing-together
  list would fix both.
- **The processing title stays "Складаю відлуння"** (owner's word), though
  it now shows before every card and a free entry has no echo.
- **The text screen:** "Опиши свій стан" over the field (was "Скажи одним
  реченням"), "Введи текст…" inside it (was "Сьогодні я…"), "Поділитись"
  on the button (was "Прочитати"); English "Describe how you feel",
  "Type here…", "Share". "Скасувати" under the button is gone; the way out
  is the back arrow top left (`BackButton`, the prop is now `onBack`).

Seen on the simulator: the text screen with the arrow, the new title,
placeholder and button, and the arrow going home; the plain card after a
saved entry's corrected text, with "Зберегти" alone. Not in build 42; goes
with the next.

---

## 3η. The card goes up whole, and choosing together is one list — 2026-10-01

The owner's word, after clicking through §3ζ.

- **"Виправити текст" is a button, under the words.** The pencil pill inside
  the transcript block read as one more tag beside the emotion chips. It is
  now a whole-width secondary `Button` with the pencil (Button took an
  optional `icon`), under the block rather than in it; tapped, the block
  turns into the editor as before. `FixWording` draws it, so the entry page
  got the same button.
- **The card goes up only once the words to offer are there.** While Vidlun
  reads, the turn stage is drawn as the processing screen; the card appears
  whole, transcript, button, question and words together, and so does a
  re-read after a corrected transcript. "Добираю емоції до сказаного…" and
  the waiting line under the buttons are gone (`turn.gathering`,
  `turn.waiting`). **This moves M4's measure:** the wait now runs to
  Vidlun's reading — about two seconds on the phone — not to the
  transcript. On a network that hangs rather than fails, the processing
  screen stays until the analysis gives up (20 s an attempt, one retry), and
  only then does the card come up with the broad words.
- **Choosing together is one list, everything in it chosen.** "Твій
  варіант" is gone, with the "Порівняння" eyebrow over it (there is no
  comparison left), "Ні, залишу своє" and "+ Назвати самому". Under "Vidlun
  почув": the person's own words from the card first, then Vidlun's, all
  solid with the mark that takes them off (four at most, the entry's
  ceiling); a word taken off becomes "+ word" and the same tap puts it back;
  "+ Своє слово" adds one of the person's own at the end. `toggleKept`,
  `addKept`. Taking off any word Vidlun started with is logged as the
  disagreement — they come already chosen, so that is an act, not an
  absence of taps (`declinedVidlunsWords`, which leaves out a word the
  ceiling kept out to begin with).
- **"Саме так" is "Зберегти" there, and "Не зовсім" is gone** (new key
  `compare.save`). The plain card keeps both: it now shows only when a save
  fails, and after the text of a saved entry is corrected on its page.
- **Back goes to the card, as it was:** the comparing stage remembers the
  turn it came from (`card`), with the reading and any echo since in hand.
- **A hard entry chooses together on the same list.** It used to get the
  plain card so its answer was never set beside Vidlun's; nothing is set
  beside anything now. Its flag still brings grounding on the saved screen.

Seen on the simulator: text → processing screen → the whole card with the
new button; "Обрати разом" → the list with Vidlun's two words solid, one
taken off and put back, "Тиша всередині" typed in, back → the card as it
was; a word picked on the card then "Обрати разом" → that word first, all
three chosen, "Зберегти" → saved with all three; the corrected transcript →
processing → the card with new words; the entry page with the new button.
Not in build 42; goes with the next.

---

## 3ζ. The question is no longer a setting — 2026-10-01

The owner's word: every entry opens on the words nearest to what was said,
to choose from or to answer with one's own, and there is no way to switch
that off.

- **"Питати спочатку мене" is gone from the profile**, with its three copy
  keys (`settings.asksFirst`, `settings.asksFirstOn`,
  `settings.asksFirstOff`) and the `asksFirst` field of `Settings`. A
  stored record that still carries the flag reads without it and the next
  write drops it, so someone who had switched the question off gets it
  back.
- **`useCaptureFlow` no longer takes `asksFirst`.** The question card always
  goes up; `whenAnalysisLands` lost its `asking` parameter; the path that
  put the analysis straight onto the plain card, and saved an unheard entry
  at once with no words, is gone. The plain card stays where §3ε left it: a
  hard entry after "Обрати разом", and a save that failed.
- **CLAUDE.md M6's "Done when: … a switch in settings" is overruled by the
  owner.** Entries saved while the switch was off hold no unaided answer,
  so the growth view counts nothing for them, as before.

Seen on the simulator: the profile goes from the subscription row straight
to the reminder; a typed entry opens on the question card with the eight
nearest words. Not in build 42; goes with the next.

---

## 3ε. A named answer is saved at once — 2026-09-30

The owner's word, after clicking through §3γ: the card after a named answer
was one screen too many.

- **"Далі" with a word chosen or typed saves the entry** and goes to
  "Збережено" — no plain card, no comparison. `cardAfterAnswer` returns a
  new `saving` stage (drawn as the processing screen), and an effect runs
  the same `save` the card's "Саме так" runs. What Vidlun heard stays on
  the entry as the proposal, so the revision log and the granularity metric
  see what they saw before. A hard entry is saved the same way; its flag
  still brings the grounding offer on the saved screen. CLAUDE.md M6's
  reveal after every answer is overruled by the owner: it is now on
  request.
- **The card still shows** after "Обрати разом" (the comparison, or the
  plain card on a hard entry), with the question switched off in settings
  (the plain card, as M6 requires — the switch is gone since §3ζ), after
  "Не зовсім" (the edit screen),
  and when a save fails (the plain card comes back with the draft, so
  "Саме так" tries again).
- **An echo that lands after the save is written into the entry.** The
  paid echo comes from a slower model. One that lands while the person is
  still choosing goes in with the entry, as before; one that lands later
  is written in by `AttachObservation` (new use case) — only into an entry
  that exists, has no echo yet, was not edited since, and is not a crisis
  entry. Home and an entry page already open on it catch up.
- **Topics are nouns.** The owner's entry "Зараз змінюю додаток…" showed
  "користуватися" under "Про що говорили" — the pretend analysis's
  longest-word stand-in from §3γ, now withdrawn: it names no topic, because
  a stand-in reads as a real, wrong one. The real prompt was tightened all
  the same: at most three topics in the speaker's language, each a noun in
  its dictionary form, never a verb, a feeling or a word copied in the form
  it was said. Not yet checked against the live model — the simulator
  cannot reach the proxy.
- **For the simulator:** `EXPO_PUBLIC_FAKE_ANALYSIS=1` also swaps in
  `FakeObservationWriter`, a pretend echo marked as such that lands eight
  seconds after the reading, so the late case can be walked with
  `EXPO_PUBLIC_FAKE_PURCHASES=active`.

Seen on the simulator (Debug build against Metro, frames every 0.2 s): a
chosen word and "Далі" went to "Збережено" and home with no card between;
"Обрати разом" opened the comparison; on the paid side the new entry's page
opened without an echo and the echo appeared on it a few seconds later. Not
in build 42; goes with the next.

---

## 3δ. A journal card lost its last line to a rounding error — found and fixed 2026-09-30

The owner, on the iPhone 17 simulator: in the journal, the 11 September card
("Вечір із мамою по телефону. …") showed two lines, the second ending
"…і сам трохи хви" cut mid-word, then an empty band a line high above
"Тривога". The card is `EntryCard`, which sets no line limit — the drawing's
feed shows the whole sentence — so nothing in the app asked for a cut, and
AppText's Dynamic Type caps had no part in it: at the default size the line
is 23 points when measured and when drawn.

**React Native's rounding, not our layout.** Fabric on iOS draws a paragraph
into a TextKit box exactly the size of the view's frame and keeps only the
lines that fit whole; with no line limit, the last line that fits takes the
rest of the sentence and is clipped at the edge (the "cut" was half an "л").
Yoga computes the frame's height as the difference of two edges rounded to
the pixel grid and stored as float32. The event rule above the card ("Нова
робота", 13.5 and 12.5 type on one baseline, as drawn) leaves everything under
it a third of a point off the grid, and this card's text runs from 2008.33 to
2077.33 — across 2048, where a float32 loses a bit. The two edges rounded
differently and the frame came out 68.9998779296875 for three 23-point lines
(`onLayout` on the simulator; `onTextLayout` reported two lines, the second
holding the rest of the sentence). The same can take the only line of a
headline or the second line of a clamped row anywhere: it needs a box a third
of a point off the grid — any text size but the default makes those
everywhere — straddling a power of two. Open upstream: facebook/react-native#53450;
the Yoga fix (react/yoga#1860) is unmerged.

**Fixed in AppText, which every text in the app goes through.** On iOS each
text box gets 0.01 pt of bottom padding and the same taken back as margin
(`textSlack`, added to whatever padding and margin the caller gave). A box
whose height is off the grid is one Yoga rounds up rather than down, so the
frame gets a third of a point more than the text needs and no float error can
take a line; the margin keeps the box's outer size, so nothing around it
moves. `textSlack.test.ts` ports Yoga's rounding (float32 included) and
TextKit's whole-line rule: the model reproduces 68.9998779296875 for the
card, and with the slack every line survives across every style at every text
size, 1 to 8 lines, both screen densities and every power of two up to 65536.
It failed against a slack of nothing.

Seen on the simulator (Debug build against Metro, the seeded journal): the
card reads "…Вона / хвилюється, я заспокоюю, і сам трохи / хвилююся." with no
band. Every card sits where it sat, the same `pageY` to the last digit; the
profile and the top of the journal are pixel-identical with and without the
slack. Home differs by one pixel: the date line sits in a wrapping row centred
by `alignItems: 'center'`, where Yoga centres by the border box and the text
rises 0.005 pt. Remove `textSlack` once React Native ships the rounding fix.
Not in build 42; goes with the next.

---

## 3γ. The card simplified, the same evening — 2026-09-30

The owner's word, after clicking through §3β on the simulator.

- **The question card.** Titled "Що ти зараз відчуваєш?" with "Можеш
  обрати одну емоцію або кілька." under it; "Правильної відповіді немає"
  and the "що почув Vidlun — лише коли попросиш" line are gone.
- **A handful of words near what was said, with no shelves.** First read
  as "stop filtering" and shipped to the simulator with the whole palette;
  the owner corrected it the same hour: the card offers only the words
  closest to what was said, as one flat list with no category names, and
  a word of one's own when none fits. `emotionsNear` (emotionTone.ts)
  takes eight words from the first two levels of the wheel, never a
  sensitive one nor the `compound` branch: the side of the palette Vidlun's
  reading falls on (a mixed reading keeps both poles, taking turns from
  each; with no feeling heard the mood decides), nearest first by valence
  (weighted double) and energy, the heard word itself leading a tie. While
  Vidlun reads, "Добираю емоції до сказаного…"; when it cannot listen, the
  seven broad root words (`wordsWithoutReading`). A chosen word still opens
  its children. `EmotionPicker.tsx` now exports the flat `EmotionShelf`.
  **"Далі" is disabled until a word is chosen or typed**; "Обрати разом"
  stays open. The M6 conflict §3β raised stands; the owner confirmed the
  narrowing.
- **Two buttons, one under the other:** "Далі" (primary) and "Обрати
  разом" (secondary), replacing "Не знаю — покажи одразу". "Далі" with
  named words → the plain card with them (since §3ε: saved at once);
  "Обрати разом" → the comparison,
  the person's words so far kept as their unaided answer beside Vidlun's
  (`chooseTogether`, a `together` flag on the turn stage for when the
  analysis is still reading). "Далі" with nothing named still shows the
  comparison. Offline, either button saves what was named.
- **The comparison lost its difference block** ("Слова різні…" and the
  other `diff.*` lines): it confused more than it named. `difference.ts`
  and its test went with it. CLAUDE.md M6's "third card" is overruled by
  the owner.
- **Mood is a word in its colour, not a scale:** `MoodLine` (a dot in the
  mood scale's tone and the label) replaces the ring on the comparison and
  the ring plus "N з 5" on the entry screen (`detail.ofFive` removed). The
  edit screen's 1–5 picker stays — it is how a mood is set.
- **Tags are named:** "Про що говорили" / "What it was about" over the
  context tags on the comparison, the plain card (`EntryChips` now puts
  feelings and topics apart), the entry screen and the edit screen (was
  "Контекст"). They are the topics the analysis picks out of what was said.

The pretend analysis now names a topic too (the entry's longest word), so
the caption can be seen in the simulator. Withdrawn in §3ε: the stand-in
read as a real, wrong topic.

---

## 3β. The question card, reshaped — 2026-09-30

The owner's word, four changes to the card that asks before it answers.

**The palette is open at once, and only its near side.** The card no longer
hides the shelves behind "+ pick a feeling": once Vidlun has read the words
(about two seconds; "Добираю емоції до сказаного…" until then) it puts out
the shelves on the side of the palette what was said falls on —
`groupsNear` in `emotionTone.ts`, read off Vidlun's proposal side by side,
never averaged: pleasant words → the two pleasant shelves, hard ones → the
two hard shelves, a mixed state → all four, no feeling heard → the mood
decides (≥4 pleasant, ≤2 hard), neither → all four. Offline (Vidlun could
not listen) → all four. **This goes against CLAUDE.md's M6 rule** that no
part of Vidlun's answer shows before the person's: which side of the palette
is offered is a hint of it. Built as asked; the brief needs the owner's
update if it stays.

**A word of one's own.** "+ Своє слово" under the shelves opens one line.
A typed word the vocabulary already has, in either language ("вдячність",
"tired"), becomes that word (`emotionIdForLabel`); anything else is kept as
typed under an `own:` id (`src/domain/entities/OwnWord.ts`) and travels in
the same lists as the vocabulary's ids, so the four-word ceiling, the
revision log and the granularity metric count it. It is drawn in ink
(`emotionTint`), never in a tag's faint ring; search finds it; the weekly
narrative gets it as a quoted word; `ReviseEntry` keeps it. The row of
chosen words moved under the shelves, beside the pill, so the first pick no
longer pushes the palette down under the finger.

**A named answer is not shown Vidlun's list.** Someone who picked or typed
anything goes to the plain card with their own words ("Твої слова");
Vidlun's list appears only after "Не знаю — покажи одразу" (or "Далі" with
nothing chosen). What Vidlun heard stays on the draft as the proposal.
`comparisonOf` became `cardAfterAnswer`; the hard-entry rule is unchanged.

**Re-reading after a correction, checked.** On the question card
("Виправити текст") the corrected words are re-read — seen on the
simulator: the palette moved from the pleasant shelves to the hard ones.
On a saved entry the correction re-reads too (`fixEntryWording`). On the
edit screen ("Не зовсім") it does not: the new text is saved, and the
emotions, mood, tags and echo stay those of the old text. Reported to the
owner, not changed.

Copy: `turn.pick` removed; `turn.gathering`, `turn.ownWord`,
`turn.ownWordPlaceholder` added; `turn.hidden` now says Vidlun's answer is
shown only when asked. `Vidlun.dc.html` draws none of this — the pill reuses
the comparison card's dashed "name it" pill, the field the transcript
repair's ink ring. Checked on the simulator with a scripted analysis (App
Attest does not run there). Not in build 42; goes with the next.

**Walking the card in the simulator.** `FakeReflectionAnalyzer` answers
without the network, going round a pleasant, a hard, a mixed and an ordinary
reading, one per entry (a corrected transcript takes a turn too), after
1.5 s. Wired only under `__DEV__` and `EXPO_PUBLIC_FAKE_ANALYSIS=1`, like
the pretend store, so a release build cannot use it. Start Metro with the
flag and run the Debug simulator build.

---

## 3α. Two things taken out of the way — 2026-09-30

The owner's word, both about what felt awkward in use.

**No "tell about yesterday" before there was a yesterday.** Home offered
"Розповісти про вчора" whenever yesterday's cell in the strip was empty,
which on the first day is always: someone who installed the app an hour ago
was invited to fill a day the app was never there for. The offer now needs a
real hole — an empty yesterday in a journal that already had an entry before
it. The rule moved out of the screen into `GetHomeView` (`offersYesterday`,
read over the same year the streak reads), with five tests: shown over a
real hole, shown when the only earlier entry was late the day before
yesterday, hidden for an empty journal, hidden on the first day, hidden when
yesterday has an entry. Seen on the simulator both ways: a journal whose
only entry is today shows no offer; the seeded journal, a week quiet, shows
it.

**"Mark an event" left the statistics screen.** The list of events and the
dashed "Позначити подію" button under the week's count are gone; the owner
has not decided where marking an event belongs, so until then an event can
be made nowhere. Events already marked stay where they were shown: the rule
in the journal (tap to rename or delete), the dot in home's strip and the
label over the day in the week chart. `StatsScreen` lost the
`onMarkMilestone`/`onEditMilestone` props and the `Milestones` block; the
sheet and the use cases stay for when marking comes back. The copy key
`stats.milestones` has no reader now and is kept for that return. Both are
divergences from `Vidlun.dc.html` in the owner's words. Not in build 42;
goes with the next.

---

## 3z. The month card on home, reworded — 2026-09-29

The owner's word, for the card home shows in a month's first days: the
caption was "Місяць", the title "Твій вересень", the link "Читати". Now the
caption names the month ("Твій вересень", `home.monthKicker`), the title
invites ("Подивись, яким він був.", `home.monthLead`) and the link says
"Переглянути" (`home.monthCta`). "Він" is the month, and every Ukrainian
month name is masculine, so the line holds all year. English, written to
match: "Your September", "See what it was like.", "View". The card got keys
of its own because the week screen's month card reads `stats.monthLabel`
and `stats.monthTitle`, which stay as they were. A divergence from
`Vidlun.dc.html` in the owner's words, so the drawing follows the code.
Seen on the simulator with the clock moved to 2 October: one line for the
title in both languages. Not in build 42; goes with the next.

---

## 3y. The journal counts entries, not echoes — 2026-09-22

The owner's word: the line under the journal's title says "16 записів",
not "16 відлунь". The three plural forms (`feed.entryOne/Few/Many`:
запис, записи, записів; entry, entries, entries) go through the existing
Ukrainian rule — 1 запис, 2 записи, 5 записів, 11 записів, 21 запис — so
the ending is right for any count. Not in build 42; goes with the next.

---

## 3w. The arrow into last week did nothing — found 2026-09-22

Found while taking screenshots for the landing page: on the statistics
screen the "earlier week" step is drawn live and does nothing when tapped.
`showEarlierWeek` and `showLaterWeek` called `loadStats` from inside a
`setStage` updater that returned the state unchanged; React bails out of
such an update without committing it, and the load called from within was
lost with it. Both now read the stage in hand and call `loadStats`
directly. Not in build 42, which is waiting for review; goes with the next.
Seen once the arrow worked: "Минулий тиждень" ran under the arrows — the
display title now takes the row's slack and wraps, the arrows never shrink.
Then the owner asked for the dates instead: any week but this one is
titled by its range ("14 вер. – 20 вер.") with nothing under it, and
`stats.last` is gone from both locales.

---

## 3v. "Віха" became "подія" — 2026-09-18

The owner, reading the statistics screen: nobody says "віха" about their
own move or new job; it is a word from history textbooks. The Ukrainian
copy now says "подія" everywhere the milestone is named — the button
"Позначити подію", the sheet "Подія", "Видалити подію", the list heading
"Події", and the hint "Подія допомагає побачити, що було до і після." English
keeps "milestone", where the word is alive. The drawing says "віха" and
needs the same change. Code and keys keep `milestone`.

---

## 3u. Two reminders at nine — found 2026-09-17, fixed 2026-09-18

The owner's lock screen at 21:00: the evening reminder, twice, both "now".

**A race the adapter's own comment had predicted.** A plan is a cancel
followed by eight separate schedules, each an await on the bridge. App.tsx
asks for one whenever the preference moves, once when the app opens, and —
through `flow.home` in the effect's dependencies — again every time the
journal reloads, which at launch is a moment after the first ask. The two
ran side by side: the second's cancel landed among the first's schedules,
and every evening the first had not reached yet was scheduled by both. The
doubles then lived until the next launch reshuffled them.

**Fixed in the adapter, where it cannot recur.** `ExpoReminders` takes its
notifications through an injected `NotificationCenter`
(`expoNotificationCenter()` is the real one, the recorder's pattern), runs
requests one at a time, and lets only the newest count: a plan overtaken
while it waited does nothing, and a cancel behind a plan leaves nothing
pending. The effect now depends on `wroteToday`, the yes-or-no it actually
reads, rather than on the journal object, so a reload that changes nothing
reschedules nothing. `ExpoReminders.test.ts`: five cases; the first three
failed against the old logic with sixteen notifications for eight evenings.
A phone already carrying doubles is cleaned by the first plan the fixed
build makes — every plan begins with a cancel of everything.

Not in build 41, which was waiting for review — so 41 came out of the
queue the same day. **Build 42 uploaded 2026-09-18 17:13 EEST** (commits
e8704c0 the reminders, b60faf2 the word of §3v, 256060b the bump), VALID at
17:20; the submission carrying 41 (66578034-…) cancelled only then, so 1.2
was never out of review without a replacement in hand; the version went to
DEVELOPER_REJECTED, took build 42, the What's New with one more line ("The
evening reminder no longer arrives twice." — the race is in 1.0 and 1.1
too) and the review notes for 42, and **went back in at 17:21 EEST**:
review submission 4b0dc2ab-ee02-4418-84f2-7843d68ace00, WAITING_FOR_REVIEW.

---

## 3t. The locked week card says what it will do — 2026-09-17

The owner, reading the statistics screen on the phone without a
subscription: the paid card said "Vidlun has written about this week", then
"No patterns visible this week", then "Read in full" — and asked what any of
it meant. Nothing is written until someone pays; the pattern line repeated
the free pattern card right under it, and called a month's count "this
week"; "Read in full" dated from the first paragraph being free, which the
pricing decision of 2026-08-30 ended, so there was nothing to complete.

Now the card says what it will do — "Vidlun напише про цей тиждень: що
повторювалось, що змінилось і як звучали дні." — the pattern count is gone
from it (the pattern card keeps saying whether there is one, paid or not),
and the button is "Відкрити в підписці", which is where it goes. The line
under the button — that the narrative is the only paid thing — went too, at
the owner's word before build 41. Six keys removed, one added, one
rewritten, both locales. The month card followed the same
afternoon at the owner's word: "Vidlun напише про цей місяць: що
повторювалось, що змінилось і як звучали тижні.", the two ghost lines that
stood for a hidden text gone with the claim, and the same "Відкрити в
підписці" link. Not seen on the simulator — its previous month is empty, so
the card does not render there; the change is copy and two removed views.

**Build 41 uploaded 2026-09-17 17:58 EEST** — version 1.2, same model,
archive 763 MB; commits 2658e7e (the cards), 3a753a0 (bump), 591c969 (the
line under the button). Build 40 superseded; submit with `--build 41`
(review-notes-41.txt in the scratchpad).

**1.2 submitted for review 2026-09-18 11:07 EEST with build 41** — review
submission 66578034-cec4-452a-878a-365c5cef2d7c, version state
WAITING_FOR_REVIEW. The script attaches the build and opens the
submission and nothing more, so the listing went in through the API by
hand first: en-US What's New from the draft plus one line about the entry
surviving a dropped connection (575 chars), the description with the
built-in-model line (1771 chars), the review notes for 41 (3707 chars) on
the version's review detail, which App Store Connect had copied from 1.1
with the contact. Worth folding into `asc-submit.py` as `--whats-new`,
`--description`, `--review-notes` before the next release. After approval:
release, redeploy the legal site (privacy §2.3), archive the asset pack in
App Store Connect, carry the divergences into the drawing.

---

## 3s. The profile without captions, and the backup rows explained — 2026-09-17

The owner's afternoon corrections, both to the profile. Every caption over
a group of rows — "Plans", "Conversation", "Notifications", "Audio",
"Protection", "Backup", "Talk to us", and the "Language" caption over the
pills — is gone: the rows name themselves. `Section` lost its `label`;
the theme card keeps "Theme", which is the row's own title, not a caption.

The backup card's three hints now say what each row is for rather than
what it produces. Backup, in the owner's words: "Збережи свої записи для
переносу на інший пристрій. Аудіо не переноситься." (true: `ExportJournal`
leaves the recordings out by design). The readable export names what the
file holds — the days, the times, the words, the emotions, Vidlun's line —
and what it is for: rereading outside the app, printing, showing someone.
Restore names the occasion — a new phone, a reinstall — and nothing more:
the owner took the sentence about the merge back off, and then the
readable-export row entirely, "for now" — `ExportJournal` keeps writing
the markdown half, nothing on the profile asks for it. Eleven keys removed
from both locales, two rewritten.

**Build 40 uploaded 2026-09-17 15:52 EEST** — version 1.2, the same q8_0
model, archive 763 MB; commits 1c73ec1 (§3r), 091def7 (§3s), 632cf84
(bump). Builds 37–39 superseded; submit with `--build 40`
(review-notes-40.txt in the scratchpad).

---

## 3r. A failure is a line over the screen, not a screen — built 2026-09-17

The owner, testing 39 indoors on a weak connection: the card asked its
question, a timeout came up in place of it with a "Try again", and "Try
again" went home and took the recording with it. The owner asked for a
toast instead of the screen, and for the entry to be kept — the emotion
can be named later, when there is a connection.

**The one road a timeout on the card still had to that screen.** §3k made
the analysis's failure land on the card as the words alone, so a plain
timeout could not reach the failure screen — but the card's own repair
could. `correctWording` re-read the corrected transcript with `.catch(fail)`,
and a timeout on that re-read was the failure screen; nothing had been
written yet, so "Try again" left the take unreferenced in the recorder's
scratch space. `fixEntryWording` on a kept card, `confirm`, the recorder and
the permission check all went the same way.

**The stage is gone; a notice takes its place.** `CaptureStage` no longer
has `failed`. The hook holds `notice: Notice | null` — `{kind: 'failed',
message}` with the layer below's own words under the app's title, or
`{kind: 'unheard'}` — and `fail(error, backTo?)` sets it, moving the stage
only when it was somewhere transient. The take and the permission check go
home; `confirm` goes back to the card with the draft as it stood;
`saveUnheard` goes back to the asking card with the words and the answer,
for one more tap; `fixEntryWording` goes back to the kept card, its
correction not taken; the loaders — history, search, stats, vocabulary, the
paywall, milestones, delete — stay where they are. `Toast` draws it: the
panel surface at the top under the status bar, a 240 ms rise (none under
Reduce Motion), five seconds, a tap to leave sooner. The drawing has no
failure state at all, so the toast's look is the code's own on the owner's
instruction, to be carried into the drawing with the rest of §3q's list.

**The corrected transcript fails the way the first one did.** `ask` now
remembers both builders; `correctWording` uses them, and its failure is
`whenAnalysisFails` — the card goes on with the corrected words alone,
`unheard`, and the person's answer saves the entry through `saveUnheard`,
which `HearUnheardEntries` listens to later. Starting a re-read also clears
`unheard`, which a successful re-read after a failed first reading used to
leave set: the entry would have been saved as unheard with a good analysis
in hand. And the network's failure is now said — the "No connection" line
where the card used to go on in silence, which reads as a hang.

Copy: `notice.offlineTitle` "Немає зв’язку", `notice.offlineBody` "Запис
нікуди не дінеться, а відповідь Vidlun прийде, коли з’явиться інтернет.",
`notice.dismiss`; `failure.retry` is gone. Test: `whenAnalysisFails.test.ts`.
Checked on the simulator, where App Attest fails and so every analysis
does: typed entry → card with the line over it → "Fix the text" → the
corrected words back on the card with the line again → an emotion → next →
saved with the corrected words and the chosen emotion, on home a second
later. The line's clock was measured with a throwaway build that wrote the
dismissal into the line: 5006 ms, the timer — the earlier impression of a
two-second toast was the screenshot loop starting late.

Not covered: a correction on a kept card that fails is dropped rather than
kept for later; the recorder's own failure — no words, a broken file — still
goes home, and the take with it.

---

## 3q. The model inside the app — decided and built 2026-09-16

The day after 1.1 the owner drew the line under downloads: the Ukrainian
model ships inside the app, the smaller file, and the onboarding screen
that asked for it goes. Two things decided with it, both the owner's
words: the pack machinery goes entirely rather than staying as a fallback,
and the profile's "Speech" section goes with it — and once there is no
language to choose and no engine to show, there is one reader for every
language. Parakeet reads English; Apple's SpeechAnalyzer path (§3p) existed
only so that English speakers would not download 668 MB, and that reason
is gone with the download.

**The measurement first** (§1c, the 4-bit files): q4_0 at 356 MB is level
with q8_0 on the labelled takes, so it is the file that ships. The app
grows from 43 MB to roughly 400 for every install, English speakers'
included, and that was said before it was chosen: installs over cellular
get iOS's 200 MB question, updates stay small because the store sends only
what changed, and in exchange the first entry can be spoken the moment the
microphone is granted, on any connection or none.

**What went.** `SpeechModelStore`, `ExpoModelStorage`, `AssetPackModel`,
`AppleTranscriptionService`, `SpeechEngine`/`engineFor`, `ISpeechModel`,
`settings.speechLanguage`, the `vidlun-asset-pack` and `vidlun-speech`
modules, the `downloader` target and its build fixes, `asset-packs/`, the
pack scripts, the `BA*` Info.plist keys and the app group they needed, 41
copy keys, onboarding's model step, Home's download line and waiting card,
Profile's Speech section, and `canHear` — the flow never parks a take now.
A take parked by 1.0 or 1.1 is still on disk and is read the moment its
screen opens; `ParkedScreen` shrank to that beat.

**What came.** `speechModel.ts` (the descriptor: file name and engine),
`bundledModel.ts` (`Paths.bundle` + `File.exists`; null means a build
made without the file, which types instead of listening),
`plugins/withBundledModel.js` (the resource goes into the Xcode project
the way expo-font adds fonts; a missing file fails prebuild rather than
shipping a deaf build), `scripts/fetch-model.sh` (Hugging Face, size and
SHA-256 checked; `assets/model/` is ignored by git). The privacy policy
lost §2.3 "Downloading the speech model" and says the model is built in.

**The drawing.** `Vidlun.dc.html` still has the model screen at the end of
onboarding and the Speech section in the profile (both from §3p). Both are
now to be removed from the design rather than the code; nothing new needs
drawing.

**Seen on the simulator the same day** (iPhone 17, Release build of the
regenerated project, 441 MB with the model in the bundle): onboarding is
three screens and lands on home with the plain "tap to speak" line; the
profile runs Plans, Conversation, Rhythm, Theme, Audio with no Speech
section; a take recorded on the first launch was read by the bundled
model and the card opened with its transcript — no download, no waiting
screen, no line about a model anywhere.

**Nine corrections from the owner's first day with the store build, made
the same afternoon** (all in copy and screens, both locales): home asks
"How are you today?" instead of "What happened today?"; home's "Recent
echoes" list is gone altogether (the journal tab is where entries live),
and with it the "No echoes yet" caption on the journal; search on an empty
journal shows one line, "Nothing to search yet", instead of the "all" chip,
the "Nothing" caption and the "Nothing found / try another word / Reset"
block; streaks read "days", not "days in a row", on the profile card, the
home pill and the saved screen; the ask-first switch explains itself
("Vidlun asks you to pick an emotion, then shows what it heard"); the
"Rhythm" section is "Notifications" and the "Evening reminder" row is
"Reminder"; the thirteen-months note moved into the audio row's own hint;
"Lock on entry" is "Face ID"; the feedback row asks only what broke or is
missing; the backup rows say "All your entries in one file" and "Brings
your entries back from a backup", naming no file and no merge. Each is a
divergence from `Vidlun.dc.html`
in the owner's own words, so the drawing follows the code here. The
"Conversation" section label was left as drawn.

A second round the same afternoon: the card that asks for the person's
word lost its "Your turn" eyebrow, asks "Pick an emotion" and says only
"There is no right answer"; the saved screen shows nothing under "Saved"
but the unheard line when it applies (the streak chip is gone); the
no-pattern text no longer says Vidlun "did not see" anything; the
subscription screen lost its two feature bullets; and home's list of
entries is back as a bare list of the last three — no heading, no "all"
link, nothing while there are none.

Then the saved screen itself: one centred "Saved", no check ring, no
buttons, no unheard line, and it leaves for home by itself after a second
(`SavedScreen`, `SHOWN_FOR_MS`). The grounding offer after an overwhelmed
entry is the one case the screen still waits: an offer that vanishes in a
second is not one, so it keeps its card with "Try" and "Not now".

Onboarding, the same day: the lime blob behind the headlines is gone from
all three screens; the microphone screen says only "So you can just say it
instead of typing it"; and the privacy screen carries one line — "The
audio and text of your entries are stored on your phone" — by the owner's
decision, repeated after the 5.1.2(i) concern was raised: the line naming
Anthropic (Claude) as the reader of an entry's text, which 1.0 passed
review with, now lives only in the privacy policy linked from the first
screen. The "I agree" button stays. If App Review asks, the line comes
back as `onboarding.privacyAi` (git history, commit before this one).

Build 37 (1.2) archived and uploaded at 14:38 EEST on 2026-09-16: app and
widget 1.2 (37), the model in the archive, 383 MB on disk. The owner tests
it from TestFlight over the store install before submitting.

The same afternoon the owner asked for the file one level up: build 38
bundles q4_k (416 MB, the better Ukrainian mean in the §1c table) in place
of q4_0. `SPEECH_MODEL`, `scripts/fetch-model.sh` and the plugin's file in
app.json move together; the Xcode project reference was renamed in place
rather than regenerated.
Uploaded at 16:00 EEST: app and widget 1.2 (38), the q4_k file in the
archive, 440 MB on disk. Build 37 is superseded.

And one more level the same evening: build 39 bundles q8_0 (669 MB), the
file 1.0 and 1.1 downloaded and ran, so the phone reads with exactly what
it read with before. The app now installs at roughly 700 MB. The build
also fixes the Face ID switch: declining the Face ID ask left the native
switch sitting on, because a setting that stayed false was no change for
React to push back — the screen now holds the switch on only while the
ask is open (`armingLock`) and lets it snap back.
Uploaded in the evening: app and widget 1.2 (39), q8_0 in the archive, 681
MB on disk; the switch fix seen on the simulator (tap, ask fails, switch
back off). Builds 37 and 38 are superseded.

**Left for the release:** version 1.2, build 37; the store description and
What's New; the legal site redeploy; App Store Connect's asset pack can be
archived, and `scripts/asc-submit.py` submits versions alone from now on.

---

## 3p. The model only for those who need it — decided 2026-09-14

The 668 MB download on the second onboarding screen is the price of
Ukrainian: Apple's on-device recogniser (SpeechTranscriber, iOS 26, about
forty locales, every English variant and ru_RU among them) does not know
Ukrainian and cannot follow a sentence that mixes it with Russian, so
Parakeet stays. But someone who speaks English does not need it, and asking
them for 668 MB before the first entry is where the app ends for them. The
owner's decisions, 2026-09-14:

- The engine follows the language spoken, and the default is the interface
  language: `en` → Apple's recogniser on the device, `uk` → the model. No
  onboarding question; a "language you speak" row in a new Profile section
  overrides the default. No separate Russian option — "Ukrainian" means the
  model and covers the mix.
- For English speakers the onboarding drops the model screen (three
  screens: what this is, privacy, microphone), home loses the model line and
  the parked states never arise. For Ukrainian the four screens stay, with
  one line saying why the model is there.
- Profile gains "Speech": the language spoken, what recognises it (a fact,
  not a control), and the model as a thing with a state — download,
  progress, delete.
- The asset pack's policy goes from prefetch to on demand, so nobody gets
  668 MB unasked; Ukrainian speakers start it from the model screen as the
  in-app fallback does today. The policy is a new pack version and rides
  with 1.1, not with the pack-only submission after 1.0 — until the English
  path exists, prefetch is what makes the download seamless for everyone.
- English speakers on iOS before 26 stay on the model; the older
  SFSpeechRecognizer is not worth a separate path for a shrinking group.

The privacy promise holds for both engines: SpeechTranscriber has no server
path. The policy gets one sentence about Apple's on-device recognition for
English; the description and the review notes say "the model for
Ukrainian" instead of "the model".

Order of work, all of it 1.1, after the 1.0 decision: (1) a spike — a
native module `vidlun-speech` on SpeechAnalyzer that transcribes a file,
measured on English takes against Parakeet for accuracy and stop-to-card
time, plus two checks: whether a speech-recognition authorisation is
needed at all (on the device it should not be; if it is, it is asked at the
first recording, never in onboarding) and whether Apple's language asset
can be installed during onboarding so the first card is not late; (2)
`AppleTranscriptionService` behind `ITranscriptionService`, a router in the
container on `settings.speechLanguage` (new field, default from `locale`);
(3) the third onboarding step list; (4) the Profile section, once drawn;
(5) the pack policy; (6) metadata, notes, policy. The brief for the
drawing is artifact ca3c817c-7841-4374-b863-444e2fdc89ab.

Built on 2026-09-14, on the branch `speech-by-language` (main stays what
build 33 is, for a fix build if the review asks for one):

- `engineFor(language, appleAvailable)` in `src/domain/speech`; settings
  carry `speechLanguage`, read as the interface language for records that
  predate the field.
- `modules/vidlun-speech`: SpeechAnalyzer + SpeechTranscriber behind three
  async functions — `isAvailable(locale)`, `prepare(locale)` (the system's
  language assets, installed once and shared), `transcribe(file, locale)`,
  final results joined. Reading a file needs no speech-recognition
  authorisation, only the microphone the take already had, so no new
  purpose string. Compiles against the iOS 26 SDK.
- `AppleTranscriptionService` behind `ITranscriptionService`; the container
  gets it when the engine is `apple`, the model otherwise, typed input when
  neither is there. `canHear` is true for the phone's own engine whatever
  the model is doing, so nothing is parked. The confidence rule moved to
  `speechConfidence.ts` and serves both readers.
- Onboarding: the model screen is last and only shown when the model will
  be the reader (`WITH_DOWNLOAD`); the phone's engine and a delivered pack
  both give the three-screen list. The screen carries the drawing's
  why-line, the on-demand consent button and Later, and after the tap the
  drawing's progress card with the download running under it.
- Profile "Speech": language you speak (a sheet with two options, each
  naming its reader), recognised by (a fact), the model row with
  Download / progress hairline / Delete, the note under it; deletion asks
  first only where the model is the reader. `SpeechModelStore.remove`
  clears the file, the pause note and the delivered pack
  (`AssetPackManager.remove`).
- Home: the phone's engine hides every model line. The absent line now
  reads "The model for Ukrainian is not downloaded — voice will not work
  yet." The pack manifest is on demand. The policy's short version names
  both readers.

Checked on the simulator: the English flow (three screens, home without
the model line, the Speech section, the language sheet switching the
reader both ways) and the Ukrainian flow (four screens, the model last).
The simulator has no speech assets ("No GeneralASR asset"), so the one
read attempted there failed with "Audio format is not supported". On the
owner's iPhone (build 34, TestFlight, 2026-09-14) an English take was read by
the phone's own recogniser. The measurement against Parakeet on English
takes is still open.

1.0 (build 33) passed App Review on 2026-09-15 and waits for the owner's
release. The branch was merged into main the same morning, the version
bumped to 1.1, build 35 archived and uploaded (11:57 EEST), and asset pack
version 2 uploaded with the on-demand policy (`"downloadPolicy":
{"onDemand": {}}` is the form ba-package accepts; leaving the key out is
rejected). Pack version 1 (prefetch) is never submitted: 1.0 users take the
in-app download, 1.1 rides with version 2. Drafts for the 1.1 listing —
What's New in both languages, the description with the recognition line
changed, the review notes for build 35 — sit in the scratchpad.

**The first afternoon on sale — 2026-09-15.** The owner released 1.0,
installed it from the App Store, and the model screen said "could not
download". The cause is in App Store Connect, verified through the API and
its Help: an asset pack reaches App Store customers only after App Review,
and neither pack version had ever been submitted (both `appStoreRelease`
= Prepare for Submission). TestFlight never showed this because internal
testing takes the latest processed pack version without review. The in-app
download did not step in either, and that is the code's own gap: the
store fell back to Hugging Face only where the system had never heard of
the pack, and treated "the system knows the pack and cannot deliver it" as
a dead end — exactly the state of a pack that exists but is unreleased.
Fixed in main: `SpeechModelStore` downloads by itself whenever the system
does not hand the file over, whatever the reason (test: "downloads by
itself when the system knew the pack and could not deliver it"). For the
people already on 1.0 the remedy is pack version 2 submitted on its own
(`scripts/asc-submit.py submit-pack`, dry run `plan-pack`): once approved
it reaches every App Store install at once, 1.0 included, since the app
asks for the pack explicitly and the policy only governs what the system
does unasked. Submitted alone rather than with 1.1 on purpose — items of
one submission publish only when all are accepted, so a pack riding with
1.1 would wait out any rejection of 1.1. Lesson: a pack-only submission
belongs in the release checklist the moment the first version is approved,
before the release button.

Pack version 2 passed review within the hour (`appStoreRelease` = Ready for
Distribution, version 1 Superseded), and the phone still said "could not
download". The simulator explained the first half: `checkForUpdates()` makes
the Managed Background Assets helper fetch the app's download manifest from
the App Store, and what the App Store served at 14:00 and again at 14:03 was
`{"assetPacks":[],"isFromAppReview":false}` — no pack, whatever App Store
Connect says; the second fetch answered in 5 ms, so the client caches the
manifest as well. Ready for Distribution is not yet "on the devices", and
nothing in the app can hurry it. The same run proved the in-app road:
"No asset pack with the ID … was found" → the Hugging Face download over
the background URL session, 668,757,119 bytes in about two minutes,
onboarding moved on by itself. Two more guards went into main for build 36:
`AssetPackModule.ensure` calls `checkForUpdates()` before looking the pack
up, so a pack published after the device's cache was written is found
without a reinstall; and the store downloads by itself whenever the system
does not hand the file over. What the owner's phone did remains unread —
device logs need root (`sudo log collect --device-udid …`), and the owner's
phone had TestFlight builds whose manifest listed the pack, so a stale
TestFlight manifest failing `ensureLocalAvailability` against the App Store
channel is the leading suspicion; a fresh App Store install would meet the
empty manifest and take the Hugging Face road instead.

Found the same afternoon on the owner's phone: a typed entry's card said
"No audio kept — recordings are switched off in settings" while the switch
was on. The line was the only one the screen had for a missing recording,
and `FindRecording` deliberately folds three cases into one null. The
screen now tells them apart (`audioNoteKey`): a typed entry gets "A typed
entry — no audio", a spoken one blames the switch only while the switch is
off, and a spoken one whose audio is gone while the switch is on — recorded
before it was turned on, or thirteen months old — gets a line that claims
nothing about settings. The drawing shows no audio block at all on a typed
entry (`cardAudioGone: !cur.typed && !s.keepAudio`); the owner asked for a
line instead, so the line is a divergence to carry back into the design.

Build 36 (1.1) archived and uploaded at 14:54 EEST with both guards and
the card line; 35 is superseded and 1.1 goes to review with 36. By then
the owner's phone had started downloading the model on its own — the
manifest had caught up, or the reinstall took the direct road; the logs
were never read. Pack version 2 is live, so the 1.1 submission carries
the version alone.

1.1 with build 36 passed App Review the same evening and is Ready for
Distribution; 1.0 goes down as the version that lived one afternoon.

The drawing and the code disagree in three places, and the code is right
by App Review: the drawing's microphone screen still says "Allow" with
"Later, I'll write", its privacy screen has two paragraphs and no line
about the text going to Anthropic, and its model screen assumes the
download starts by itself ("It happens now, right after install") with
"Understood" as the only button — which is prefetch, not the on-demand
policy decided the day before. The code keeps Continue, the three-line
privacy screen with "I agree", and Download / Later, then Understood once
the transfer runs.

---

## 3o. The third rejection — 2026-09-11

App Review turned 1.0 (build 28) down again, on an iPad Air, for two things
neither earlier review had raised.

5.1.1(iv): the onboarding screen before the microphone prompt had an
"Allow" button and a "Later, I'll write" way past it. Apple reads the first
as mimicking the system dialog and the second as delaying the request;
the rule is that the only door out of a permission message is the system's
own question. The screen now has one button, "Continue" / "Далі"
(`onboarding.micContinue`), and the body says that iOS asks next and that
the answer can be changed in Settings. `onboarding.micAllow` and
`onboarding.micLater` are gone. The drawing still shows the two-button
version of this screen and needs the same change (rule 6, Apple's
exception). Someone who declines still has the typed entry and the Settings
link on home, as before.

2.5.4: `UIBackgroundModes` carried `audio`, which the expo-audio config
plugin adds by default (`enableBackgroundPlayback: true`). Nothing in the app
plays or records in the background, so `app.json` now sets it to false and
the key is gone from the generated Info.plist. Recording while the screen is
locked would be a real feature behind that key (`enableBackgroundRecording`),
and if it is ever wanted it needs a screen recording for App Review with it.

Build 31 (still version 1.0) carries both and was uploaded on 2026-09-11.

The guideline check that followed found one more gap, 5.1.2(i) as amended
on 2025-11-13: personal data shared with a third-party AI must be disclosed
in the app and agreed to before it is sent. The text of every entry goes to
Anthropic, the description and the policy said so, but the onboarding
privacy screen said only that the voice never leaves the phone, and the
welcome screen's "Skip" went around it. Build 32 added the line; build 33 cut the
screen to three short ones the owner could live with — the voice stays on
the phone, the text of an entry goes to Anthropic (Claude) to name the
feeling and write the week, recordings stay 13 months and any entry can be
deleted with its voice (`onboarding.privacyOnDevice`, `privacyAi`,
`privacyKeep`; `privacyDelete` is gone). The button is "I agree" /
"Погоджуюсь" (`onboarding.privacyAction`), and no screen skips it any more
(`onboarding.skip` is gone). "Not used for training" and the country stay
in the policy, not on the screen. Still owed under
5.1.1(ii): a way to withdraw that consent inside the app — a Profile switch
that keeps entries unanalysed — which needs its own copy for the card and
the narrative, so it waits for the next release. The drawing shows the old
privacy screen and a welcome "Skip"; both need the same edit. Reply and
review-notes drafts: scratchpad `review-reply-3.txt`, `review-notes-33.txt`.

Found on the way, and likely what the reviewer's iPad showed: the
onboarding frame did not scroll, so on an SE-sized window the model screen
and the privacy screen overflowed — the headline ran under the kicker and
the size card under the button. The middle of the frame is a ScrollView
now (centred where there is room; it reaches into the side margins so the
headline's blob is not clipped), and the rail, kicker and button stay put.

---

## 3n. iPhone Duo — analysed 2026-09-10, the foundation built

Apple showed iPhone Duo on 2026-09-09: a 5.4″ outer display (1398×2034 px,
about 466×678 pt at 3×) and a 7.6″ inner one (1878×2670 px, about 890×626 pt
open like a book, 626×890 held in portrait), iOS 27.1, on sale 23 October.
The rules that matter here, from the five Tech Talks and the new HIG page
"Designing for iPhone Duo": one compact and one regular layout rather than a
layout per pose; the inner display is regular in both dimensions and ignores
`UISupportedInterfaceOrientations`; safe areas are asymmetric because the
status bar, the Dynamic Island and the system bars stand along one side, and
each app in Split View gets its own side; system tab bars and toolbars go
vertical on the outer display and on the open device in landscape; nothing
interactive sits on the fold, scrolling content excepted; sheets and alerts
move off the fold on their own.

What the current build does there: it runs (Apple: no recompile needed; only
the strip beside the status bar stays unused until the 27.1 SDK). The outer
display is a wider, shorter iPhone — fine. The inner display in landscape is
the problem: every screen becomes one 890pt column, and everything centred —
the record button, the stop button, the middle of the floating TabBar, the
card's actions, every sheet — lands on the fold. Held in portrait the fold is
horizontal, and the bottom-third rule already keeps the primary action below
it.

The toolchain gate: anything built with the iOS 27 SDK must use the UIScene
life cycle or it does not launch ("UIScene life cycle is required for apps
built with this SDK"). Expo 57.0.15's prebuild template still hands React
Native a `UIWindow` from `AppDelegate` with no `UIApplicationSceneManifest`
(expo/expo#46663 is open), and RN 0.86's `RCTReactNativeFactory` has no scene
API. So Xcode 27 RC (out 2026-09-09) gives nothing yet; Xcode 27.1 beta — the
Duo simulator in Device Hub, `ReservedRegion`, edge to edge on the inner
display — is due later in September and final around late October. Whether
to wait for Expo's scene support or migrate ourselves is the owner's call;
the report recommends waiting unless nothing has shipped by the end of
October.

Built today, design-neutral: `useDrawnSides` — each side of a screen is the
device's own side safe area plus the drawn margin (22; 20 for sheets; 12 for
the recording tile; `theme.spacing.lg` for edit and reflection), each side
independent of the other. The `Screen` canvas, the scrolling screens, search,
recording, both sheet components, the profile's time sheet, the purchase
outcome modal and the TabBar's 14pt edges go through it. On today's phones
the side insets are zero, so nothing moved. `scripts/sim-wide.sh` builds the
simulator app as universal with landscape allowed and installs it on the
iPad mini simulator (1133×744), the nearest stand-in for the inner display
until Xcode 27.1.

Not built, waiting on the drawing (rule 6): the regular-width screens — Home
as two pages (greeting and the record button on the left, the day on the
right), journal and search as list plus entry, statistics in two columns, the
recording and the card split across the fold, sheets as cards off the fold,
the TabBar as a vertical pill beside the system controls wherever a side
inset exists. Then, with the 27.1 SDK: measure `insets.top` on the outer
display (its status bar is on the side, so `useDrawnTop` may need a floor), a
small native module for reserved regions instead of "the fold is at the
middle", and every pose plus Split View in the simulator. The Ukrainian
report is artifact 64243338-f461-484a-ac2a-ea010512639e.

Decisions not to make: no landscape on ordinary iPhones, no multiple scenes
(`UIApplicationSupportsMultipleScenes`), no layout per pose, no hinge-angle
effects.

---

## 3m. The journal and search scroll a window, not the whole year — built 2026-09-09

Audit item five, and the last of the first batch.

`HistoryScreen` and `SearchScreen` render through `FlatList`: a handful of
rows past the screen edge rather than every card the journal holds, the
12pt between cards as a separator, the title and the empty state as the
list's own header and empty component. The journal's `interleave` of
entries and milestones runs once per journal (`useMemo`), not once per
frame, and both row renderers depend only on what a row reads, so a
re-render of the screen does not re-render every visible card.

Search changed shape a little on the way: the field and the filters stay
put and only the results scroll. A search box that scrolls away has to be
scrolled back to before every second try, and a list that owns the
keyboard's field re-mounts it on every keystroke.

Debt 4.14 (the whole journal read in one query) stands; the repository's
cache makes it one read, and the list no longer pays for it twice.

---

## 3l. First frame, large type, every phone's own bar — built 2026-09-09

Audit items three and four.

**Fonts are in the binary.** The five faces sit in `assets/fonts/` under
their PostScript names and go in through the `expo-font` config plugin, so
the theme provider no longer waits on `useFonts` before drawing anything;
the wordmark placeholder that bridged that wait is gone with it. The
`@expo-google-fonts` packages are out; the splash script reads the same
file the app does.

**Dynamic Type is capped where the screen is dense, not where it is read.**
`typeScaleCap` in `tokens.ts` gives each style its ceiling — headlines
1.2, the chrome 1.3–1.5, entries and the narrative 2 — and `AppText`
passes it as `maxFontSizeMultiplier`; a component in a tighter spot
(the streak pill, the two links under the strip) passes its own. Found on
the way: `createTypography` multiplied line heights by the font scale, and
React Native multiplies them again, so large type came out with lines twice
as far apart as the text; the tokens now hold the drawing's line heights
and let the platform scale once. The home header and the strip's link row
wrap instead of clipping.

**Safe area is measured.** `react-native-safe-area-context` is in, the app
sits in a `SafeAreaProvider`, and `useDrawnTop(drawn)` turns a number from
the drawing (70, 74, 82, measured on a Dynamic Island phone with a 59pt bar)
into this device's bar plus the same margin. `Screen` and the eleven
screens that padded their own ScrollViews use it; the tab bar sits over the
home indicator by the drawn 8pt, or at 12pt where there is none. Checked on
an iPhone SE simulator.

---

## 3k. Nothing said is lost to the network — built 2026-09-09

The first two items of the September audit, together because they are one
failure seen twice.

**A failed analysis used to cost the entry.** `ask` caught the analyzer's
rejection with the generic failure screen, whose "Try again" went home, and
the words the person had just spoken went with it. Now `ask` takes a third
builder: `CreateUnheardEntry` makes the draft from the words alone (no mood,
no words of Vidlun's, nothing cleaned up) and the card goes on as it was —
the person names their word, and `saveUnheard` writes the entry as theirs
through `ConfirmEntry` with an empty proposal, then remembers the id in
`AsyncStorageUnheardEntries`. The saved screen says so in one line. If the
failure lands on a card already being held, the answer is saved as it
stands; with the question switched off it is saved at once with no words.

**Heard later.** `HearUnheardEntries` runs on open and each time the app
comes to the front (App.tsx holds the AppState listener, because the hook
must stay importable in plain Node). Oldest first, stopping at the first the
network will not carry. Vidlun's late answer fills only what the person left
blank: their words, a corrected transcript, a mood they set, tags they wrote
all stay, and the answer takes its usual place as the proposal. The
observation is not written late; that stays the card's affair.

**The client no longer waits ten minutes.** `timeout: 20_000, maxRetries: 1`
on the Anthropic client; the two Sonnet writers pass `PATIENT_TIMEOUT_MS`
(45 s) per call. After five seconds of holding, the card and the processing
screen change their line to "still working" (`processing.still`).

Not covered: the recorder failing, or the save itself failing, still land on
the failure screen, which now only ever sees things that are not the
network's fault.

---

## 3j. The speech model as an Apple-hosted asset pack — uploaded 2026-09-07

The 668 MB Parakeet model now sits in App Store Connect as asset pack
`parakeet-tdt-06b-v3-q8`, version 1, state COMPLETE (App Store Connect ids
in `scripts/asc-submit.py status`). Upload went through `xcrun altool
--upload-asset-pack` with the App Store Connect key — the same delivery
pipeline Transporter uses, which is not installed on the build Mac.

**Policy: prefetch, on first installation and every update.** Not essential:
an essential pack rides inside the App Store install, so first launch would
wait on 668 MB and the text path — which needs no model — would wait with
it. Prefetch keeps the install small, the system fetches the model in the
background under the App Store's own cellular rules, and the app's own
download offer stays as the fallback for a phone that has not got it yet.

**Where it stands.** Internal TestFlight: `READY_FOR_TESTING` — builds 22
and 23 in the "Test Vidlun" group can download it from Apple now, which is
the first real end-to-end delivery test; the simulator only ever saw
`ba-serve`. External TestFlight: `READY_FOR_BETA_SUBMISSION`. App Store:
`PREPARE_FOR_SUBMISSION` — an asset pack reaches customers through a review
submission, alone or with an app version, and App Store Connect takes one
submission per platform at a time. Version 1.0 (build 19) is waiting for
review, so nothing more can be submitted until it is decided.

**The 1.0.1 plan, once 1.0 is decided.** Bump `expo.version` to 1.0.1,
build 24, upload; then `scripts/asc-submit.py submit --version 1.0.1
--build 24` creates the version, attaches the build, opens a review
submission with the version and the pack, and asks once before submitting.
`plan` with the same arguments prints the calls without making them. Build
19 already carries `BAHasManagedAssetPacks`, so once the pack is approved
it also reaches 1.0 users; 1.0.1 is the vehicle for the widgets, the year
echo and the milestones rather than a requirement of the pack.

---

## 3i. The first wave after 1.0 — built 2026-09-07

Design round 4 drew three things and the brief put them in this order:
widgets, then the echo from a year ago, then milestones. All three are in
the code as of build 22; the widgets are the only native piece.

**Record without opening.** `targets/widget` is a WidgetKit extension
(iOS 18 and up) with the Lock Screen circle, the rectangular Lock Screen
widget, the small Home Screen tile and a Control Center button. Every one of
them opens `vidlun://record`; the Control Center button and Siri go through
`RecordIntent`, which lives in `_shared/` so the same intent exists in the
app, and `VidlunShortcuts` gives Siri "Record in Vidlun" and the Action
Button something to be set to. The app side is `useRecordLink`: the link
waits for the journal to be open — not over onboarding, not behind the
lock, not mid-card — and then starts a take. Verified on the simulator from
a cold start, and on the owner's iPhone 14 Pro (iOS 26.6.1) the same day:
the widgets open the take, the Control Center button does too, and Siri
runs "Record in Vidlun" — but on a cold start Siri landed on the home
screen (2026-09-08). Siri opens the app first and only then runs the
intent, and the URL the intent opened arrived before JavaScript was
listening, which React Native drops. The intent now leaves a request
behind instead (a flag in the app's defaults and a notification, read
through `modules/vidlun-record-request`); the widgets keep their URL,
which the system launches the app with. The widget carries two strings of
its own in Swift (the record
label and the home question) because an extension cannot read the app's
dictionary; if the design changes `wRecord` or `homeQ`, change them there
too. No streak on the widget, by design: a zero reads as a reproach.

**The echo from a year ago, with its voice.** `GetHomeView` now finds the
same day one year back and hands the card the recording when the thirteen
month retention still has it. The card plays it in place through the
inline `Playback` variant; a take past its date shows the crossed
microphone and says so. 29 February has no anniversary and gets no card.

**Milestones.** A labelled day (24 characters at most), kept in its own
AsyncStorage record, never inside an entry. Shown as a tick under the
week strip, a label with a hairline through the chart, a rule row in the
journal, and a list with an add button on statistics. `MarkMilestone`
marks today or renames; `ForgetMilestone` removes. The sheet is drawn in
the tree, not in a `Modal`, for the reason §2b's feedback sheet is.

**Not yet seen working:** the Action Button binding — the owner's phone
is a 14 Pro and has no Action Button, so it waits for a tester with a 15
Pro or later.

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
