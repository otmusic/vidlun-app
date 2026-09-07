# Vidlun — Development Brief

> Paste this as your first message in Claude Code, or save it as `CLAUDE.md`
> in the project root so it stays in context across sessions.

---

## 0. Absolute rules

**Read these first. They override any other instruction in this document.**

0. **Communication language.** Reply to the developer in **Ukrainian** —
   explanations, questions, summaries, progress reports, and clarifications.
   Everything that lands in the repository stays **English**: code, comments,
   JSDoc, test names, commit messages, file names, README, and any documentation
   file. Two different channels: talk Ukrainian, write English.
1. **English only, everywhere in the codebase.** Identifiers, comments, JSDoc,
   test names, commit messages, file names, README, error messages thrown in
   code. No Cyrillic characters in any `.ts`/`.tsx` file.
2. **User-facing copy never appears inline.** All display strings go through
   the i18n layer as keys (`t('home.prompt')`). Translations live in
   `src/i18n/locales/*.json`. That is the only place non-English text exists,
   and it is data, not code.
3. **No `any`.** If a type is genuinely unknown, use `unknown` and narrow it.
4. **Every milestone ends green**: `npm run typecheck && npm test && npm run lint`
   must all pass before moving on. Do not start the next milestone with a
   failing build.
5. **Ask before adding a dependency.** Prefer the standard library and what is
   already installed.
6. **`Vidlun.dc.html` is the design. Nothing else is.** Every screen, every
   number, every string of user-facing copy comes from it — read the markup
   before building, not only the copy keys, because the structure is part of
   the design and inventing a layout that "follows the principles" still
   produces a screen nobody drew. It lives in the Claude Design project
   `85fa8e02-a6fe-472a-8f41-52107f474a39` and is read with the `DesignSync`
   tool (`get_file`). Where it is silent, say so and ask — do not fill the gap
   and move on. `design/*.html` in this repo is older and outranked by it, and
   a prototype's own scaffolding (`ios-frame.jsx`, `support.js`) is not design:
   that is the phone bezel and the canvas runtime, which iOS and React Native
   already provide.

---

## 1. What we are building

Vidlun is a voice-first emotion journal for iOS. The user taps one button, says
how they feel, and AI turns it into a structured entry: cleaned transcript,
mood score, emotions, context tags, and one short observation. The user
confirms with one tap or corrects with one more.

**The product thesis is the absence of friction, which is not the same as
brevity.** Every competitor makes you fill a form. Filling a form is friction:
time spent on mechanics rather than on what you meant to say. Waiting for the
app is friction too. Talking is not — that is the time the person chose to
spend, and it is the product working.

So the budget is on everything except the speaking. Tap to recording, stop to
card, confirm to saved: those must be short and must stay short however long
the person spoke. Any change that adds friction to the capture path is wrong by
default, even if it adds a nice feature.

**Naming your own feeling belongs in the same category as speaking.** It is the
person spending their own time on the thing they came to do, not the app
spending it for them. So the card asks before it answers: the person names the
entry first, and Vidlun's version arrives second. This costs no wait, because the
question is asked into the pause the analysis already needs — see M6, which now
begins inside the capture path instead of after it.

**How long is an entry?** Observed at about twenty seconds across two people's
real recordings — thin evidence, and the only evidence there is. Assume that
shape rather than a single terse sentence. Short entries stay entirely valid:
§5's second regression case is "Cooked dinner." and §6 insists that zero
emotions is a complete entry. They are just not what performance is designed
around, and an entry that takes longer to speak must never take longer to
process.

**The AI proposes, it never decides.** The reflection card is a draft. Nothing
is written to storage until the user confirms it.

**The person decides when a take ends.** The recorder used to stop itself after
a second and a half of quiet, which read as attentive and was not: gathering
your words mid-sentence is the most ordinary thing to do on a screen that asks
how the day went, and ending the take there is the app deciding you had
finished. A pause is part of speaking. There is still a ceiling, far past any
real entry, so a recording left running in a pocket cannot fill the disk.

**The recording is kept for thirteen months, then only the audio is deleted.** A
transcript loses the thing a voice journal was for: "I'm fine" said evenly and
said barely holding together read identically on the page. Hearing yourself six
months back is worth more than reading yourself, and it is the same argument as
M6 — the product is for learning to recognise your own states, and tone is part
of the evidence. Thirteen months rather than twelve, so the yearly echo can
still play the voice on its anniversary (owner's decision, 2026-09-07). After
that the audio goes and the entry stays whole: mood,
emotions, transcript, everything the history is made of.

This is the journal, and only the journal. The grounding exercise (M8) still
saves nothing at all, and the difference has to be visible in the copy — a
person who knows the app keeps their voice will not mumble into an exercise
meant to calm them.

Target audience speaks Ukrainian and Russian, often mixed in one sentence. The
speech pipeline must handle that. The codebase must not.

---

## 2. Stack and constraints

- React Native + Expo, TypeScript in `strict` mode
- **iOS ships first. Android follows.** Build iOS-first, but never
  iOS-only: keep all platform-specific code behind an adapter, use
  `Platform.select` rather than forking components, and avoid iOS-only
  libraries when a cross-platform one exists. Concretely — audio recording,
  speech-to-text, notifications, secure storage, and haptics are the
  platform-sensitive areas; each must sit behind a port interface so the
  Android implementation is a new adapter, not a rewrite. Do not add
  `.android.tsx` files yet, but do not write anything that would make one
  unavoidable later.
- Jest + ts-jest for tests
- On-device speech-to-text via `whisper.rn` (works on both platforms — a
  second reason to prefer it over Apple's framework). **Transcribe while the
  person is still speaking, not after they stop.** Measured on 2026-08-25:
  post-hoc transcription costs 265 ms per second of audio, so the wait grows
  with how much someone had to say — the app would charge most for its best
  entries. Streaming makes the wait after the stop a constant.
- Cloud LLM for analysis (Claude Haiku for per-entry, Sonnet for weekly summary)
- Local-first storage; no backend in the MVP, with one exception that is not
  one in spirit: `server/` is a Cloudflare Worker that holds the Anthropic key
  and rate-limits calls. It stores nothing, has no accounts, and keeps no
  record of what anyone wrote. Anything shipped in a bundle can be read out of
  it, and a key read out of it spends the owner's money — that is the whole of
  why it exists. Nothing else may move there without reopening this line.
- No state management library until a milestone actually needs one

---

## 3. Architecture

Three layers, dependencies point inward only.

```
presentation ──┐
               ├──▶ application ──▶ domain
infrastructure ┘
```

| Layer | Contains | May import |
|---|---|---|
| `src/domain/` | entities, value objects, port interfaces, domain errors | nothing external |
| `src/application/` | use cases | `domain` only |
| `src/infrastructure/` | adapters implementing ports | `domain` |
| `src/presentation/` | screens, components, hooks, theme | `application`, `domain` types |
| `src/di/` | composition root | everything |
| `src/i18n/` | translation keys and locale files | nothing |

**The domain layer must not import React, React Native, Expo, network clients,
or `whisper.rn`.** If you find yourself needing to, the design is wrong — move
the concern into an adapter behind a port interface.

Folder layout:

```
src/
  domain/
    entities/        MoodEntry, Emotion, EmotionVocabulary
    value-objects/   MoodScore, Confidence
    ports/           I*.ts interfaces
    errors/
  application/
    use-cases/
  infrastructure/
    audio/           expo-av recorder
    transcription/   whisper.rn adapter
    analysis/        LLM adapter + vocabulary data
    persistence/     AsyncStorage + in-memory
    system/          clock, id generator
  presentation/
    theme/
    components/
    screens/
    hooks/
  i18n/
  di/
__tests__/
  domain/
  application/
```

---

## 4. Coding standards

**SOLID, concretely:**

- **SRP** — one reason to change per class. `MoodScore` knows the 1–5 scale and
  nothing else.
- **OCP** — adding a cloud transcription provider means writing a new class that
  implements `ITranscriptionService`. No use case changes.
- **LSP** — `InMemoryMoodEntryRepository` and `AsyncStorageMoodEntryRepository`
  must be interchangeable in every test.
- **ISP** — small focused ports. Do **not** create one `IAiService`. Keep
  `ITranscriptionService`, `IReflectionAnalyzer`, `INarrativeGenerator` separate:
  they use different models and will change independently.
- **DIP** — use cases receive interfaces via constructor injection. Concrete
  classes are wired in `src/di/container.ts` and nowhere else.

**Other rules:**

- Domain entities are **immutable**. Mutation returns a new instance
  (`entry.withEmotions([...])`). This makes "what AI proposed vs what the user
  kept" trivial to diff, which is the training data for personalization later.
- Value objects validate in a static factory and throw typed domain errors.
- Never throw raw `Error` — extend `DomainError`.
- Functions do one thing; if a method needs a section comment, extract it.
- Comments explain **why**, never **what**. No comment restating the code.
- Prefer `readonly` on all interface fields and array parameters.
- Time and IDs are injected (`IClock`, `IIdGenerator`) — never call `new Date()`
  or generate IDs inside domain or application code, or tests become flaky.

---

## 5. Testing

Coverage is weighted by risk, not spread evenly.

| Area | Threshold | Rationale |
|---|---|---|
| `src/domain/` | 95% lines | core invariants |
| `src/application/` | 90% lines | product rules |
| `src/infrastructure/` | 60% lines | thin wrappers, mock-heavy |

Rules:

- Domain and application tests run in plain Node — no emulator, no native mocks.
- Use hand-written fakes implementing the ports. Do not use `jest.mock` for
  our own interfaces.
- Test names describe behaviour, not method names:
  `'keeps both poles of a mixed state instead of averaging them'`.
- Every bug fix starts with a failing test.

**Regression suite — these four cases come from real user recordings and must
always pass:**

1. **Mixed state.** "Finished three tasks, happy, but very tired" → two
   emotions from different branches, mood 4. Failing behaviour: one neutral
   emotion, or mood 3. Averaging destroys the meaning of the entry.
2. **Mundane entry.** "Cooked dinner." → empty emotion array. Failing
   behaviour: inventing any emotion. This is the most important test — one
   fabricated insight destroys trust in every later one.
3. **Broken transcript.** Low transcription confidence → emotions lifted to
   level 1, entry flagged for user review.
4. **Out-of-vocabulary output.** If the model returns an unknown emotion id,
   drop it silently. The domain must never crash on model output.

---

## 6. Domain model

### MoodEntry (aggregate root, immutable)

```ts
id, createdAt, source: 'voice' | 'text',
rawTranscript, cleanTranscript,
mood: MoodScore,
emotionIds: readonly string[],           // max 4, what the user kept
selfEmotionIds: readonly string[],       // max 4, named before Vidlun answered
proposedEmotionIds: readonly string[],   // max 4, what Vidlun proposed
contextTags: readonly string[],
observation: string | null,
confidence: Confidence,
safetyFlag: 'none' | 'distress' | 'crisis',
wasRevisedByUser: boolean
```

### Emotion vocabulary

Based on the Feeling Wheel (Gloria Willcox, 1982). Three levels:
`sad` → `sad.lonely` → `sad.lonely.abandoned`.

Each emotion carries: `id` (English, dot-separated), `depth` (1–3),
`valence` (1–5), `energy` (`high` | `low`), `tier`
(`core` | `extended` | `sensitive`), `parentId`.

**IDs are English and stable. Display labels live in i18n locale files keyed by
id.** The vocabulary data file contains no human-language labels.

Seven roots: `happy`, `surprised`, `bad`, `fearful`, `angry`, `disgusted`,
`sad`, plus a `compound` branch for everyday concrete states
(`compound.money_anxiety`, `compound.awaiting`, `compound.good_tired`).

### Business rules that must be enforced in code

| Rule | Why |
|---|---|
| **Depth equals confidence.** High → level 3, medium → level 2, low → level 1. Lift the emotion up the tree rather than guessing specifics. | Better a broad correct emotion than a narrow invented one. |
| **Zero emotions is a valid entry**, not an incomplete one. | Ordinary days exist. |
| **Mood is independent of emotions.** Someone can feel `bad.tired` and rate the day 4. | Tiredness after achievement is a good day. |
| **Mixed states are never averaged.** Return both, from different branches. | Averaging erases the entry's meaning. |
| **AI never proposes `sensitive` emotions** — only exact text matches. The user may still pick them manually via drill-down. | Suggesting "worthlessness" in one tap can push someone deeper than they actually feel. |
| **`safetyFlag: 'crisis'` forces `observation = null`.** | A cheerful reflection on a crisis entry does harm. What the app shows instead is a product decision, not the model's. |
| **Choosing a heavy emotion is not itself a crisis signal.** The flag comes from content analysis only. | People are allowed to feel bad without the product reacting. |
| **Drafts are not persisted.** `CreateVoiceEntry` returns an entry; only `ConfirmEntry` writes it. | The card is a proposal. |
| **Every user revision is logged** (proposed ids vs final ids). | Training data for v2 personalization; must be collected from day one. |
| **Audio belongs to the entry and outlives neither it nor thirteen months.** Deleting an entry deletes its recording; a recording older than thirteen months is deleted on its own. | Keeping a voice after someone removed the entry it belonged to is the kind of thing that ends trust in a journal permanently. |
| **`proposedEmotionIds` is set once, at creation, and never changes.** It is Vidlun's own answer and defaults to nothing else. | M6 has to render an entry without revealing the analysis, and every entry needs the proposal — not just the corrected ones the revision log covers. The draft now starts from what the person named, so defaulting the proposal to `emotionIds` would file their guess as the model's. |
| **`selfEmotionIds` is what the person named before seeing Vidlun's answer, and it is written once.** Empty is a real value, not a missing one: naming nothing is an answer. | It is the only unaided measurement the entry carries. The moment the person adopts one of Vidlun's chips, `emotionIds` stops being theirs alone, and emotional granularity — M6's core value signal — would be measured off Vidlun's vocabulary rather than the person's. |

---

## 7. Design system

Three principles first, because they explain every rule below: **quiet by
default** (saturation is loudness), **content over chrome**, and **one colour
means exactly one thing**.

### 7.1 Colour

The identity changed on 2026-08-27; `design/` and
`src/presentation/theme/tokens.ts` are the source of truth, and the values
below are there in full.

Warm paper and near-black ink, an acid lime, and a teal accent. **The loudest
control on a screen carries the most contrast, not the most colour** — the
primary button is ink on light and paper on dark. That is what keeps the accent
meaning one thing: Vidlun is speaking, or this is a control.

**Lime marks the record button and the highlight behind a headline. Nothing
else.** It is the one saturated thing in the product and it stops being a
signal the moment it appears twice.

**Emotion colour is derived, never assigned.** 125 words carry a valence and an
energy, both 1–5; `emotionColor.ts` blends them into a hue in OKLCH under a
single chroma ceiling, with lightness fixed per theme so no feeling looks
heavier than another because of brightness. Depth adds chroma and takes
lightness; it never shifts the hue. The identity fixes seventeen words by hand
and the function leaves those alone.

**No emotion is ever the colour of an alarm.** The hue domain starts at
terracotta and never enters the signal range — enforced by a test across the
whole vocabulary, not by care. A red border on "loneliness" says *something is
wrong with you*, which is the one thing this product must never say. The same
holds for the mood scale, whose lowest state is a warm terracotta.

### 7.2 Typography

Two families with a strict role split — but the split is headline against text,
not voice against chrome.

| Face | Used for | Never used for |
|---|---|---|
| **Unbounded** | headlines, the kicker above them, and every figure | anything read as a sentence |
| **IBM Plex Sans** | everything meant to be read, prose included | headlines |

Scale, all in `createTypography`: hero 31/1.16, display 27/1.15, kicker 19,
lede 17/1.55, quote 16/1.6, body and label 15, secondary 14, caption 13
uppercase with 0.1em of tracking. Headlines carry negative tracking; Unbounded
is wide, and without it a headline reads as spaced out rather than set.

- **The transcript stays at 16** while the rest of the text sits at 15. People
  re-read their own entries at night, and that is the line they come back to.
- Exactly three greys (`ink`, `inkSoft`, `inkFaint`) — never invent a fourth.
- **Support Dynamic Type.** No fixed heights on text containers; everything
  stretches with the system font size.

### 7.3 Spacing, shape, touch

**Take the numbers from the drawing.** Spacing, radii and sizes come from
`design/` screen by screen — 18, 20, 22, 26, 34 — and are not rounded to
anything. The old 8-grid rule existed to keep arbitrary values out of the code
when there was nothing to measure against; now there is, and rounding to the
nearest 8 would be inventing numbers rather than avoiding them. The `spacing`
scale survives for gaps no drawing specifies.

- Radii: card `22`, panel `26`, tile `18`, control and chip fully round.
- **Minimum tap target 44pt**, list rows `52`. Icons may look small — the touch
  area must not be. Expand the hit area rather than the glyph.
- Buttons: 18 above and below, 20 either side; a ghost button 14.
- Primary action lives in the **bottom third** (thumb zone). Never at the top.
- One primary button per screen; everything else is secondary or text.

### 7.4 Icons

**One anchor icon per block, never inside a paragraph.** An icon identifies
what a block *is* (a reminder, a pattern, a streak, a tag) so the eye
recognises it without reading. Icons scattered through prose slow reading down
and turn text into a list.

- Thin weight (light/regular). Bold icons shout.
- Muted colour (`inkSoft`) unless the icon carries the block's role.
- 16–20px inline, 24px maximum.
- Prefer a cross-platform icon set; on iOS, SF Symbols scale with Dynamic Type
  automatically, so keep sizing token-driven rather than hard-coded.

### 7.5 Motion and haptics

- Spring curve `cubic-bezier(.2,.9,.3,1.2)`. No bounces, no parallax.
- **The record button is the only element allowed continuous motion**: two
  rings leave it and fade, 3.4s apiece and half a cycle apart. They travel
  outward and never inward — the mark's own idea, that sound goes out and stops
  being there. The recording screen's bars are the exception that proves it:
  they are the voice itself, not decoration.
- The orb is gone. It was a soft disc with a glyph; the identity replaced it
  with an ink circle carrying the mark, and the two other modes it used to have
  belong to screens that now draw their own thing.
- Screen transitions: the reflection card rises from the bottom; state changes
  cross-fade. Nothing slides sideways.
- **Haptics** on: recording start, stop, and save. This matters more than
  usual here — the user often is not looking at the screen while speaking.
- Respect **Reduce Motion**: disable animation without breaking layout.

### 7.6 Dark theme

Not an inversion — a separate palette. The evening is the primary usage
scenario, so this is not optional polish.

**Which one shows.** The app follows the phone and keeps following it, so a
journal opened at night is dark without anyone having chosen anything. Someone
who picks light or dark in settings gets that always: a preference the time of
day can override is not a preference. `system` is the default.

- **Background is not black** (`#14161B`). Pure black with light text is harsh
  and reads cold.
- **Text is not white** (`#F2EEE6`). Contrast stays within norms without the
  "torch in the eyes" effect.
- Depth comes from **surface elevation** (card lighter than canvas), not shadows.
- **The solid inverts**: the primary button is ink on light and paper on dark,
  and `onSolid` flips with it. This is where quick dark modes usually break.
- **Every hue lightens.** Colour goes grey on dark grounds, so the dark values
  are lighter and slightly more saturated throughout — including the lightness
  the emotion palette is generated at.
- **Nothing glows at night.** The record button stays muted and only the glyph
  is bright. A glowing ring fills the screen with light in a dark room.

### 7.7 Surfaces and glass

If using iOS 26 Liquid Glass: **navigation layer only** — a floating control
above content. **Never on cards containing text about feelings.** Translucency
over busy backgrounds destroys hierarchy and readability. Reflection cards,
narrative blocks, and the emotion palette stay opaque.

### 7.8 Accessibility

- Text contrast minimum **4.5:1** in both themes.
- **Colour is never the only carrier of meaning** — the mood scale is always
  accompanied by a label or position.
- Every icon-only control has an accessibility label; decorative icons are
  hidden from screen readers.
- Visible focus state: 2px accent ring with 2px offset.

### 7.9 Copy and tone

Copy is a design surface here, not an afterthought.

- Vidlun observes, never diagnoses, advises, or praises. Acceptable: "Sounds like
  the good kind of tired." Not acceptable: "You show signs of burnout"
  (diagnosis), "Try going to bed earlier" (advice), "Well done for coping!"
  (evaluation).
- Never use warning colours or alarm icons on difficult emotions. A red border
  on "loneliness" says *something is wrong with you*.
- **Address the user in the present tense.** Ukrainian and Russian past-tense
  verbs carry the addressee's gender, so a line like "what would you have called
  it" exists in two forms and whichever one ships is wrong for half the
  audience. Present tense and noun phrases stay genderless, and there is no
  acceptable both-endings-in-brackets fallback. This constrains the English key
  too: phrase it so the translation can avoid the past tense at all.
- Empty-head rescue: when the user opens the app and has nothing to say, rotate
  gentle prompts under the orb ("What is most on your mind right now?").
  "I don't know what to write" is the main reason journals get abandoned.

### 7.10 Known open issues

Inherited from the design system; do not treat these as settled:

- `warm` and `tension` resolve to the same amber in both themes. The old rule
  kept honey for achievements alone; the new identity gives achievement no
  colour at all, so this is no longer a collision — but nothing may start
  reading amber as "well done" either.
- The derived palette gives two words with identical coordinates the same
  colour. `happy.playful` and `surprised.excited` are both (5, 5). An anchor is
  the fix where it matters; the rule is not.
- The insights screen scrolls on small phones. Verify the narrative card fits
  above the fold on an SE-sized device.

### 7.11 Reference

A clickable HTML prototype exists covering 25 screens in both themes. Capture
path: splash, auth, welcome, privacy, permission, first, home, listening,
thinking, reflect, edit, saved. Retention: insights, growth, settings, locked,
paywall. Reflection mode: reflect-invite, guess, reveal. Grounding (M8):
ground-offer, ground-see, ground-hear, ground-touch, ground-done. Use it as the
source of truth for layout and flow.

**`Vidlun.dc.html` is the only design.** Absolute rule 6 says why; this section
says what is in it. Read the markup and not only the copy dictionary — the
structure is the design. It is one reactive prototype rather than artboards:
fifteen screens switched on a `screen` variable, a `T` dictionary of ~240 uk/en
keys, the emotion palette, the mood scale and both themes.

**Superseded on 2026-08-27** by that file, which is the current drawing: it carries the new identity and screens the older
files never had — tabs, feed, search, profile, calendar, the palette sheet.
Measure against that one. The two files below still describe flow accurately
and live in `design/`:
`vidlun-prototype.html` covers screens and flow, `vidlun-design-system.html` covers
tokens and components. They are self-contained — open them in a browser. Their
UI copy is Ukrainian because it mirrors the shipping locale; that is reference
data, and absolute rule 1 still applies to everything under `src/`.

`guess` and `reveal` are now the capture card's two states as well, not only
reflection mode's own screens; `reflect` is what the card looks like with the
mode switched off, and `reflect-invite` is the way back into an entry already
saved. The counter drawn on `guess` belongs to that way back and has no meaning
during capture.

---

## 8. Build order

Complete milestones in order. Each ends with a green build and a commit.

### M0 — Foundation
Expo + TypeScript strict, Jest, ESLint, folder structure, i18n scaffold with
`en` and `uk` locale files, CI-ready npm scripts, font loading (Unbounded +
IBM Plex Sans, since the 2026-08-27 identity change) wired into the theme
provider.
**Done when:** `npm test` runs (even with zero tests) and typecheck passes.

### M1 — Domain
`MoodScore`, `Confidence`, `Emotion`, `EmotionVocabulary`, `MoodEntry`, domain
errors, all port interfaces. Vocabulary seed data (ids and metadata only).
**Done when:** domain tests cover invariants, hierarchy traversal, depth
lifting, immutability, and the 4-emotion limit at ≥95% lines.

### M2 — Use cases
`CreateVoiceEntry`, `ConfirmEntry`, `ReviseEntry`, `GetWeekSummary`.
**Done when:** all four regression cases from §5 pass with fake adapters.

### M3 — Adapters
`ExpoAudioRecorder` (tap to start, tap to stop, permission handling),
`WhisperTranscriptionService`, `ClaudeReflectionAnalyzer`,
`AsyncStorageMoodEntryRepository`, `SystemClock`, `UuidGenerator`, DI container.
**Done when:** a real recording produces a real draft on device.

### M4 — Capture flow
Screens: Home (orb, streak, recent entries), Recording, Processing, Reflection
card, Edit. Text input fallback. Theme provider with light/dark.
**Done when:** the wait from stop to reflection card is two to three seconds on
a real phone and does not grow with how long the person spoke, and no component
contains an iOS-only assumption that would need an `.android.tsx` twin.

The old wording — "capture-to-save under ten seconds" — counted the speaking as
part of the cost and so measured the wrong thing. Time spent talking is not a
cost to reduce.

Now that the card asks before it answers, the wait is measured to the question,
which needs only the transcript; the analysis finishes behind it. Time the
person spends choosing a word is not part of the measurement, for the same
reason the speaking is not.

### M5 — Retention and monetization
Insights screen (free daily trend + paywalled weekly narrative), onboarding
(privacy screen before the microphone permission request), settings with
reminder time picker, local notifications, playback of a kept recording, and
the old-audio sweep (thirteen months).

Keeping recordings is a setting, not a question at onboarding. Asking someone
where their voice goes before they have said anything into the app is the worst
possible moment to ask, and whatever the default is will decide it for almost
everyone regardless.
**Done when:** the free/paid boundary matches §6 and nothing in the capture
path got slower.

### M6 — Reflection mode (the question ships with the card; the growth view is post-MVP)
A capture flow that answers for you teaches nothing: AI names the feeling, the
user taps yes. The therapeutic value of an emotion journal comes from *affect
labeling* — the act of finding the word yourself. Taking that work away leaves
a user with clean statistics and zero growth in self-understanding after two
months.

**Reflection mode asks before it answers, and it does so during capture.** The
question goes into the pause the analysis already needs, so it costs the
capture path no wait at all. This replaces the earlier plan of separating
capture from reflection *in time*, which bought the same learning at the price
of a second visit the user had to choose to make — and the moment the words are
freshest is the moment they were just spoken.

- **Entry point:** the card itself. The invitation on Home stays, but for
  entries already saved — a way back into an old one, always dismissible, never
  blocking, never a nagging badge.
- **Guess first:** the card opens with the transcript and **nothing else the
  analysis produced** — no emotions, no mood, no context tags, no observation,
  and no placeholder whose count gives the answer away. "What would you call
  this?" An escape hatch — "I don't know, show me" — is mandatory, and naming
  nothing is a complete answer.
- **Never asked on a difficult entry.** `distress` and `crisis` skip the
  question and go straight to the card. Asking someone in trouble to play at
  naming is the worst thing the app could do with that moment.
- **Reveal:** the user's answer and Vidlun's are shown as **two separate cards**,
  never merged. A third card names the difference and quotes the user's own
  words as evidence.
- **Disagreement is a first-class action.** "No, I know what I felt" must be as
  prominent as accepting. Vidlun is not an authority on someone else's feelings.
  Log disagreements separately: they are either model errors or genuine
  self-knowledge, and both are valuable.
- **Growth view:** distinct emotions used per month, and distribution across
  vocabulary depth.

Introduces the metric that becomes the product's core value signal:
**emotional granularity** — how many distinct emotions the user employs and at
what depth of the wheel. It also answers "why keep paying in month three"
better than mood charts do.

**Architectural requirement:** three separate fields, from day one —
`selfEmotionIds` (unaided), `proposedEmotionIds` (Vidlun's), `emotionIds` (what
was kept). Rendering an entry without revealing the analysis needs the second
split; measuring granularity honestly needs the first, because after the reveal
the kept set is a mix of both.

**Done when:** reflection mode is entirely optional — a switch in settings —
and turning it off leaves capture exactly as fast as before and the card
exactly as it was.

### M7 — Scaffolding fade (design before building)
Assistance decreases as competence grows: week 1 full tags, week 3 root branch
only, week 6 confirmation only. The product should make itself unnecessary.

**Risk:** users may read this as "the app got worse" or "the AI got dumber".
Never silently reduce help on a timer. Make it explicit and opt-in — "ready to
try without hints?". Requires user testing before implementation.

### M8 — Voice grounding (post-MVP, validate before building)
A 5-4-3 sensory grounding exercise the user speaks aloud: name five things you
see, four sounds you hear, three things you feel on your skin. Voice is what
makes this ours — meditation apps can only narrate or ask you to type.

**This is regulation, not journaling.** The distinction drives every rule below.

- **Triggered by content, never by a timer.** Offered after an entry the
  analyzer flagged as difficult. Apple Watch prompts blindly on biometrics and
  gets dismissed; we know the person just said they are anxious about tomorrow.
- **Nothing is saved.** No transcript, no analysis, no entry created. Say so on
  the closing screen — people need to know it is safe to mumble into the app.
- **No gamification.** No streak, no points, no "well done". Completion is a
  state, not an achievement; celebrating it cheapens it.
- **Skip is always available** on every step. Not finding all five things must
  never block progress — getting stuck inside an anxiety exercise makes anxiety
  worse.
- **Classic 5-4-3-2-1 is cut to 5-4-3.** Smell and taste are where people stall
  indoors. Three reliable senses beat five with two that irritate.
- **Whisper support.** Anxiety often strikes where speaking aloud is awkward.
  Say this in the UI copy.

**Manual tap fallback — required, not optional.** Speech recognition of a single
whispered word in a noisy room is the worst case for STT, and a dot that fails
to fill is infuriating at exactly the moment the user is most fragile. Tapping a
dot marks it complete.

**Tapping counts the item only. It never opens a text field.** The value of the
exercise is noticing and naming aloud; the word itself is data we do not keep.
A keyboard would pull the user's eyes to the screen and away from the room,
which is the opposite of grounding. Recognised items display the heard word;
manually tapped dots fill silently with no word — we show only what we actually
heard and never fabricate.

**Screen design:** one instruction at a time, large type, generous space. The
user is looking around the room, not at the phone. The filling dots are the
entire feedback loop — they prove the app is with you.

**Do not make claims about effect.** "Try naming a few things around you", never
"this reduces anxiety by 30%". 5-4-3-2-1 is a recognised technique for anxiety
and panic, so people may open it in a genuinely bad state: have the copy
reviewed by a mental health professional.

**Validate first, cheaply.** In the concierge test, simply message after a
difficult entry: "want me to walk you through a minute of grounding?" and count
how many accept. If almost nobody does, this is not worth building.

**Done when:** the exercise is fully optional, saves nothing, and works
end-to-end with speech recognition disabled.

---

## 9. Do not

- Do not put any Cyrillic text in code files.
- Do not use `localStorage` or `sessionStorage`.
- Do not add cloud speech-to-text. Tried and removed on 2026-08-28, so this is
  now a measured rule rather than an assumed one: the cost objection turned out
  to be out of date, and the rule survives on the other two grounds. Gemini was
  twice as slow as Parakeet on the phone, and where it was wrong it was wrong
  fluently — a sentence nobody said, which nothing downstream can catch. See
  BACKLOG §1g.
- Do not build v2 features: pattern detection, voice-topic analysis, health
  data integration, personalization, append-to-entry.
- Do not gate basic tracking or backups behind the paywall. Only AI narrative
  is paid.
- Do not add analytics or crash SDKs until M5.
- Do not "improve" the capture flow by adding steps, confirmations, or optional
  fields. The question the card opens with is not a precedent for granting
  others: it adds no wait, and it is the one thing the product exists to teach.
- Do not show any part of Vidlun's answer before the person has given theirs —
  that includes the observation, the mood, the context tags, and the number of
  chips it found.
- Do not put an icon inside a paragraph of text, or use a single font for both
  the interface and Vidlun's voice.
- Do not write iOS-only code without an interface behind it — Android is next,
  not hypothetical.
- Do not reply to the developer in English.
- Do not add a text input anywhere in the grounding exercise, and do not
  persist anything the user says during it.
- Do not add breathing exercises, meditations, or a library of techniques —
  that is a different product category with far better funded competitors.
- Do not build scaffolding fade before M5 ships. Reflection mode's question now
  lives in the capture card and is built with it — but keep `selfEmotionIds`,
  `proposedEmotionIds` and `emotionIds` as three separate fields, or the
  granularity metric ends up measuring Vidlun's vocabulary instead of the
  person's.

---

## 10. Known technical risk — verify before M4

Ukrainian is **not** in Apple's `SpeechTranscriber` supported locale list on
iOS 26. Russian is; Ukrainian is not. That is why the plan uses `whisper.rn`
on-device rather than Apple's framework.

**Before building screens**, run this experiment: transcribe 15–20 real
recordings containing Ukrainian, Russian, and mixed speech through
`large-v3-turbo` and `small`. Compare word error rate, processing time on a mid
range device, model download size, and battery impact.

Three possible outcomes:
- Quality is good → proceed as planned.
- Good only on the large model → trade app size against accuracy, decide explicitly.
- Poor → the whole STT approach and the free-tier limits need rethinking, and
  the privacy copy in onboarding must be rewritten to match reality.

Report the result before continuing. Do not silently fall back to cloud STT.

**Resolved, and then verified with numbers — 2026-08-28.** Parakeet closed the
quality question by ear in August and has now been measured against both
Whisper and a cloud recogniser on the 16 labelled takes. It is the best of the
three at being exactly right and the fastest by a wide margin, so the on-device
plan holds and the privacy copy in onboarding remains true as written. See
BACKLOG §1d through §1g.
