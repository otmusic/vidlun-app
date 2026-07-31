# Luna — Development Brief

> Paste this as your first message in Claude Code, or save it as `CLAUDE.md`
> in the project root so it stays in context across sessions.

---

## 0. Absolute rules

**Read these first. They override any other instruction in this document.**

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

---

## 1. What we are building

Luna is a voice-first emotion journal for iOS. The user taps one button, says a
single sentence about how they feel, and AI turns it into a structured entry:
cleaned transcript, mood score, emotions, context tags, and one short
observation. The user confirms with one tap or corrects with one more.

**The product thesis is speed.** Every competitor makes you fill a form. If
capturing an entry takes more than ten seconds, people quit within two weeks.
Any change that adds friction to the capture path is wrong by default, even if
it adds a nice feature.

**The AI proposes, it never decides.** The reflection card is a draft. Nothing
is written to storage until the user confirms it.

Target audience speaks Ukrainian and Russian, often mixed in one sentence. The
speech pipeline must handle that. The codebase must not.

---

## 2. Stack and constraints

- React Native + Expo, TypeScript in `strict` mode
- iOS first; do not add Android-specific code paths yet
- Jest + ts-jest for tests
- On-device speech-to-text via `whisper.rn`
- Cloud LLM for analysis (Claude Haiku for per-entry, Sonnet for weekly summary)
- Local-first storage; no backend in the MVP
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
emotionIds: readonly string[],   // max 4
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

---

## 7. Design tokens

Two themes. The accent colour **never** appears in the mood scale — teal means
"Luna speaking / this is a control", the scale means "this is your feeling",
honey means "achievement". One colour, one meaning.

```ts
light = {
  canvas: '#EDF2F1', paper: '#FAFBFB',
  ink: '#26302F', inkSoft: '#61706E', inkFaint: '#93A09D',
  line: '#E2E6E6', lineSoft: '#ECF0EF',
  accent: '#3E7C82', accentSoft: '#E2EDEE', accentInk: '#2F6167',
  onAccent: '#FFFFFF',
  warm: '#D9A05B', warmSoft: '#F7EBD8', warmInk: '#8A5E22',
  calm: '#3FA88A', tension: '#D8A268', low: '#C77B62',
}

dark = {
  canvas: '#101615', paper: '#19211F',
  ink: '#E7EBE8', inkSoft: '#A3B0AC', inkFaint: '#71807C',
  line: '#2A3432', lineSoft: '#232C2B',
  accent: '#6FB8BC', accentSoft: '#1E2E30', accentInk: '#9AD3D6',
  onAccent: '#0C1413',
  warm: '#E0B77E', warmSoft: '#2E2519', warmInk: '#EBC894',
  calm: '#5FC7A6', tension: '#E0B77E', low: '#D8907A',
}
```

- Spacing on an 8-grid: `4, 8, 16, 24, 32`. No arbitrary values.
- Minimum tap target 44pt. Icons may look small; the touch area must not be.
- Type scale: display 25, body/narrative 16 (line-height 1.6), label 15,
  secondary 14, caption 11.5. Never below 14 for readable text.
- Support Dynamic Type — no fixed heights on text containers.
- Spring animation curve `cubic-bezier(.2,.9,.3,1.2)`; respect Reduce Motion.
- Mood scale has **no signalling red**. The lowest state is a warm terracotta.
  A difficult day must not look like an error.

---

## 8. Build order

Complete milestones in order. Each ends with a green build and a commit.

### M0 — Foundation
Expo + TypeScript strict, Jest, ESLint, folder structure, i18n scaffold with
`en` and `uk` locale files, CI-ready npm scripts.
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
`ExpoAudioRecorder` (tap to start, auto-stop on silence, permission handling),
`WhisperTranscriptionService`, `ClaudeReflectionAnalyzer`,
`AsyncStorageMoodEntryRepository`, `SystemClock`, `UuidGenerator`, DI container.
**Done when:** a real recording produces a real draft on device.

### M4 — Capture flow
Screens: Home (orb, streak, recent entries), Recording, Processing, Reflection
card, Edit. Text input fallback. Theme provider with light/dark.
**Done when:** capture-to-save takes under ten seconds on a real phone.

### M5 — Retention and monetization
Insights screen (free daily trend + paywalled weekly narrative), onboarding
(privacy screen before the microphone permission request), settings with
reminder time picker, local notifications.
**Done when:** the free/paid boundary matches §6 and nothing in the capture
path got slower.

---

## 9. Do not

- Do not put any Cyrillic text in code files.
- Do not use `localStorage` or `sessionStorage`.
- Do not add cloud speech-to-text in the MVP — it breaks both the privacy
  promise and the unit economics for free users.
- Do not build v2 features: pattern detection, voice-topic analysis, health
  data integration, personalization, append-to-entry.
- Do not gate basic tracking or backups behind the paywall. Only AI narrative
  is paid.
- Do not add analytics or crash SDKs until M5.
- Do not "improve" the capture flow by adding steps, confirmations, or optional
  fields.

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