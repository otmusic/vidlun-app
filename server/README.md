# vidlun-proxy

Holds the Anthropic key so the app does not have to. Nothing else: no storage,
no accounts, no logs of what anyone wrote.

## Deploy

    npm install -g wrangler
    wrangler login
    wrangler secret put ANTHROPIC_API_KEY   # the real Anthropic key
    wrangler secret put APP_TOKEN           # any long random string
    wrangler deploy

Then in the app's `.env`:

    EXPO_PUBLIC_API_PROXY_URL=https://vidlun-proxy.<subdomain>.workers.dev
    EXPO_PUBLIC_APP_TOKEN=<the same APP_TOKEN>

Leave both unset and the app talks to Anthropic directly with its own key,
which is fine on a development build and is the thing this exists to stop in a
published one.

## What this does not solve

`APP_TOKEN` ships inside the app bundle, so it is extractable in exactly the
way the Anthropic key was. What it buys is that extracting it costs the owner
a rate-limited quota rather than an uncapped Anthropic bill, and that rotating
it is a Worker secret rather than an App Store release.

The real fix is App Attest: iOS can prove a request comes from a genuine build
of this app, and the Worker can require that proof. Until then this is a lock
on the door of a building anyone can walk around.
