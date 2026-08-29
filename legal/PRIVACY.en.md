# Vidlun Privacy Policy

**Effective:** 29 August 2026
**Data controller:** `[LEGAL NAME]`, `[ADDRESS]`
**Contact:** `[EMAIL]`

## The short version

- **Audio never leaves your phone.** Speech recognition runs entirely on the
  device, offline.
- Only the **text** of a transcript leaves — so a language model can name the
  feelings and write the weekly piece.
- **No accounts, no sign-up, no analytics, no trackers, no advertising.**
- We have no server that stores your entries. We physically cannot read them.

## 1. What is kept on your phone

| Data | Where | How long |
|---|---|---|
| Voice recordings | the app's documents folder | 365 days, then deleted automatically; immediately if "Keep recordings" is off |
| Transcript, emotions, mood, topics, time | the app's local storage | until you delete it |
| Revision log: what the app proposed and what you changed | local storage | until you delete it |
| Settings | local storage | while the app is installed |
| The saved weekly piece | local storage | until you delete it |

None of this is sent to us. Deleting the app destroys all of it.

## 2. What leaves the phone

### 2.1 The text of an entry, for analysis

**What exactly.** The cleaned transcript of one entry. For the weekly piece: the
date, the mood number, emotion codes, topics and the transcripts of a week's
entries together.

**Where to.** Through our Cloudflare Workers proxy to Anthropic PBC (USA), to
the Claude API.

**Why.** To propose names for feelings, write an observation, and write the
weekly piece. This is what the app is installed for.

**Lawful basis** (GDPR Art. 6(1)(b)): performance of our contract with you.

**The proxy stores nothing.** It has no database and keeps no log of request
content. It exists for one reason: to hold the API key outside the app, because
a key shipped inside an app can be read by anyone.

**Anthropic** handles this as an ordinary API request: it is not used to train
models, and is retained for a limited period for abuse prevention. See
<https://www.anthropic.com/legal/commercial-terms> and
<https://www.anthropic.com/legal/privacy>.

**What is never sent:** audio, your name, email, contacts, location,
advertising identifiers, device identifiers.

### 2.2 Purchases

Handled by Apple and RevenueCat, Inc. (USA). They receive an anonymous install
identifier, the Apple receipt, purchase and renewal events, the store country
and the device type. **No entry content reaches them.**

Lawful basis: performance of contract. See <https://www.revenuecat.com/privacy>.

### 2.3 Downloading the speech model

Once after installation, the app downloads a speech model (about 600 MB) from
huggingface.co. That host sees your network address and the fact of the
download. Nothing of yours is sent to it.

### 2.4 Network data

Cloudflare, as the network intermediary, sees the address a request came from.
It is used only to rate-limit requests and is not stored alongside anything of
yours.

## 3. Permissions the app asks for

- **Microphone** — to record. Without it, Vidlun is a text journal.
- **Notifications** — only for the reminder you switch on yourself, at the time
  you choose. The phone schedules it itself; there is no push server, and
  nobody outside can send you a notification through Vidlun.

## 4. Apple backups

If you have iCloud Backup on, the app's data — entries and audio — is included
in your device backup. That happens on Apple's side under Apple's policy, not
ours. You can turn it off for this app in iOS settings.

## 5. Your rights

Under the GDPR you have the right of access, rectification, erasure,
restriction, objection, portability, and to complain to a supervisory
authority.

What is unusual about Vidlun: **almost all of this data is only ever yours to
control.** It is on your phone, not with us:

- delete one entry — swipe it in the journal;
- delete all audio — turn off "Keep recordings" in your profile;
- delete everything — delete the app.

For purchase data, which is the only thing held off the phone, write to
`[EMAIL]`; we answer within 30 days.

## 6. Transfers outside the EEA

Anthropic, RevenueCat and Cloudflare are in the United States. Transfers rely
on the European Commission's Standard Contractual Clauses.

## 7. Children

Vidlun is not intended for children under 13, and we do not knowingly collect
their data.

## 8. Changes

If what leaves the phone changes, we will update this page and say so inside
the app before the change takes effect.

## 9. Contact

`[EMAIL]`
