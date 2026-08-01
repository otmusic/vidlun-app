# Luna — remaining work

Status as of 2026-08-01. Milestones M0 through M4 are complete and committed
(`8ce4926`): 233 tests, 98% lines, `npm run verify` green.

This file is the running list of what is left. It is not a replacement for
CLAUDE.md, which stays the source of truth for how the product should behave.

---

## Decisions already taken

| Decision | Reasoning |
|---|---|
| **Stay on Expo SDK 57.** Do not downgrade to 54. | A newer Mac is coming, which removes the Xcode ceiling. Downgrading would cost a version migration now and be reverted later. |
| Expo Go on the App Store (54.0.2) cannot run this project. | It is frozen at SDK 54; the current Expo route for iOS is a self-built Expo Go via `eas-cli go` and TestFlight. |
| Fonts load through `expo-font` + `@expo-google-fonts`, imported per weight. | The package root requires every weight, which put 36 font files in the bundle instead of 6. |
| Haptics sit behind `IHaptics`. | §2 names haptics platform-sensitive; the Android build must be a new adapter. |
| The capture path is a state machine, not a navigation library. | The flow is linear, and §2 forbids a state library until a milestone needs one. |

---

## 0. Blockers

| # | Item | Resolved by |
|---|---|---|
| 0.1 | **The app cannot run on a device.** Expo Go is 54.0.2, the project is SDK 57. | The new Mac: Xcode 26 → `expo prebuild` → local development build. Until then there is no way to run on hardware. |
| 0.2 | `EXPO_PUBLIC_ANTHROPIC_API_KEY` is empty in `.env`. | Owner fills it. Restart with `--clear`; the value is inlined at build time. |
| 0.3 | This Mac (Intel 2018, macOS Sequoia ceiling) maxes out at Xcode 16.4; SDK 57 needs Xcode 26.4. | The new Mac. |

---

## 1. M3 — unfinished tail

| # | Item | Depends on |
|---|---|---|
| 1.1 | `WhisperTranscriptionService` — the only M3 adapter still missing. | 0.1 / 0.3 (whisper.rn is a custom native module and needs a development build) |
| 1.2 | **The §10 experiment.** 15–20 real recordings in Ukrainian, Russian and mixed speech through `large-v3-turbo` and `small`; compare word error rate, processing time on a mid-range device, model download size, battery impact. | Recordings from the owner. Quality can be measured on a desktop ahead of the device work — see below. |
| 1.3 | Act on the §10 result. A poor outcome changes the free-tier limits and the onboarding privacy copy, and may reopen the whole STT approach. | 1.2 |
| 1.4 | Remove `ManualTranscriptionService` from the production path once Whisper lands; keep it as the text fallback. | 1.1 |

**§10 can be split.** Word error rate is a property of the model, not the
hardware, and whisper.rn wraps the same whisper.cpp that runs on a desktop, so
quality can be measured on the Mac now. Processing time and battery are device
properties and must wait. Mobile builds sometimes use quantised weights, so a
desktop number is a strong signal rather than a final one.

---

## 2. M4 — built, not verified

| # | Item | Who |
|---|---|---|
| 2.1 | **Measure capture-to-save under ten seconds.** This is M4's completion criterion and it is unverified. | Owner, on hardware |
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
| 4.8 | **No component tests.** Jest runs in plain Node; React components would need `jest-expo` and a testing library. The capture state machine is untested. | The largest coverage gap. |
| 4.9 | No navigation library. Fine for a linear capture path; M5 adds insights and settings. | Re-evaluate at the start of M5. |
| 4.10 | `.env` carries `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, which has nothing to do with this project. | Remove. |

---

## 5. Design questions to settle on hardware (§7.10)

- Honey and tension are close in tone and collapse to one token in the dark theme
- Green confirmation against the teal accent — verify they read as different
- The insights screen scrolls on small phones once type scales up; the narrative
  should fit above the fold on an SE-sized device

---

## 6. Explicitly out of scope (§9)

Pattern detection, voice-topic analysis, health data, personalisation,
appending to an entry, analytics and crash SDKs before M5, and any extra step,
confirmation or optional field in the capture path.
