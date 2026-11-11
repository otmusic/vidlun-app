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

## The transcriber (`/v1/transcribe`) — 2026-11-10

Parakeet Ultra (moondream/parakeet-ultra, a post-trained
nvidia/parakeet-tdt-0.6b-v3, CC-BY-4.0) runs on CPU in a Cloudflare
Container behind this worker. A take goes up as the WAV the iPhone records
(16 kHz, 16-bit, mono), the words come back as `{"text", "seconds", "ms"}`.
Same door as `/v1/messages`: an App Attest token and the per-device rate
limit. Nothing is written or logged, in the worker or in the container, and
the container has no internet (`enableInternet = false`): the model is
baked into the image, so there is nowhere for a voice to go.

- `transcriber/` holds the image: the int8 ONNX files of
  Masterx/parakeet-tdt-0.6b-ultra-onnx at a pinned commit, checked by
  sha256 at build time, and `server.py`, a standard-library HTTP server
  around `onnx-asr`.
- `standard-3` (2 vCPU, 8 GiB); the model needs about 1.6 GiB. One named
  instance, asleep after ten minutes without a take.
- Containers need the **Workers Paid** plan (on since 2026-11-11).
- The encoder ships in six ~110 MB pieces, one layer each, joined into
  `/tmp/model` when the container starts: as a single 670 MB layer it never
  finished uploading to Cloudflare's registry (broken pipe, three tries).
  Colima's daemon also pushes two layers at a time at most
  (`max-concurrent-uploads: 2` in `~/.colima/default/colima.yaml`).

### Building and deploying

`wrangler deploy` builds the image with a local Docker for linux/amd64. On
the owner's Mac that is Colima, kept apart from the Docker settings the
owner's other work uses:

    colima start --vm-type vz --vz-rosetta --cpu 4 --memory 8 --disk 40
    export DOCKER_CONFIG=$HOME/.docker-vidlun
    export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
    npx wrangler deploy
    colima stop

`~/.docker-vidlun/config.json` only points Docker at the buildx plugin
(`/opt/homebrew/lib/docker/cli-plugins`); the default `~/.docker` names
Docker Desktop's credential helper, which is not installed, and every pull
fails through it.

### Checking it from a terminal

There is no App Attest in a terminal, so the worker also accepts an
`x-probe-key` header on `/v1/transcribe`, and only while the secret
`TRANSCRIBE_PROBE_KEY` exists. `scripts/probe-transcriber.sh take.wav …`
makes a throwaway key, sets the secret, sends each take twice (cold, then
warm), prints the words and the waits, and deletes the secret however it
ends. Secrets are the owner's to set, so the owner runs it.

Locally, the image runs on its own:

    docker run --rm --platform linux/amd64 -p 18080:8080 <image>
    curl -X POST --data-binary @take.wav localhost:18080/transcribe

Under Rosetta it is slow (no AVX): a 13.5 s take took 7.9 s on two cores.
That is the Mac, not the model; the number that counts is Cloudflare's.
