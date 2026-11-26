# vidlun-proxy

Holds the Anthropic key so the app does not have to, and mails feedback on.
It keeps no entries and no logs of what anyone wrote. What it does store: the
public halves of App Attest keys and their one-time challenges (KV), and each
key's count of calls today (a Durable Object per key, one row).

## Deploy

    npx wrangler login
    npx wrangler secret put ANTHROPIC_API_KEY   # the real Anthropic key
    npx wrangler secret put TOKEN_SECRET        # any long random string; signs the daily tokens
    npx wrangler deploy

Then in the app's `.env`:

    EXPO_PUBLIC_API_PROXY_URL=https://vidlun-proxy.<subdomain>.workers.dev

Leave it unset and the app talks to Anthropic directly with its own key, which
is fine on a development build and is the thing this exists to stop in a
published one.

## Who may call it, and for what

- **Only a genuine build on real hardware.** The app proves itself with App
  Attest (`/attest/challenge`, `/attest/register`, `/attest/token`) and gets a
  token for a day. Nothing shipped in the bundle opens the door.
- **Only what the app asks for** (`src/requestShape.ts`). The body is rebuilt
  from the two shapes the app sends — a reflection on Haiku, a month on Sonnet
  — with one user turn of text, the app's longest answer per model, and no
  tools, streaming or other fields. Anything else is refused.
- **Only so much a day** (`src/allowance.ts`): per attested key and UTC day,
  100 Haiku calls, 30 Sonnet calls and 10 feedback notes, on top of the
  per-minute limit in `wrangler.toml`.

## What this does not solve

A token read off someone's own phone still works for its day, within the
allowance, and only for the app's own two kinds of request. The system prompt
is still the app's to send: building it here instead, so the caller sends only
the words, is the next step, and needs a release of the app that asks for it.
Keep a monthly spend limit on the Anthropic workspace as a backstop either way.
