"""
Speech to text for the proxy, and nothing else.

A take arrives as the WAV the iPhone recorded (16 kHz, mono, 16-bit), is
read into memory, transcribed and answered. Nothing is written to disk and
nothing is logged: not the audio, not the words, not the length of either.
The proxy in front of it has already checked that the caller is a genuine
build of the app; this server only listens on the container's own port.
"""

import io
import json
import os
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnx_asr
import onnxruntime

# onnxruntime reports usage to Microsoft unless told not to. The container has
# no internet anyway; this says the same thing in the code.
onnxruntime.disable_telemetry_events()

PORT = int(os.environ.get("PORT", "8080"))
SAMPLE_RATE = 16_000

# Five minutes is the recorder's own ceiling; a little over is the header.
MAX_SECONDS = 300
MAX_BYTES = SAMPLE_RATE * 2 * 2 * MAX_SECONDS + 4_096

SHIPPED = "/model"
# The image carries the encoder in pieces (see the Dockerfile); it is joined
# here, where the user this runs as may write. Model files only: nothing a
# person said ever touches the disk.
READY = "/tmp/model"


def assemble() -> str:
    os.makedirs(READY, exist_ok=True)
    pieces = sorted(name for name in os.listdir(SHIPPED) if name.startswith("encoder-model.int8.onnx.part-"))

    with open(os.path.join(READY, "encoder-model.int8.onnx"), "wb") as joined:
        for piece in pieces:
            with open(os.path.join(SHIPPED, piece), "rb") as part:
                while chunk := part.read(8 << 20):
                    joined.write(chunk)

    for name in ("decoder_joint-model.int8.onnx", "vocab.txt", "config.json"):
        target = os.path.join(READY, name)

        if not os.path.exists(target):
            os.symlink(os.path.join(SHIPPED, name), target)

    return READY


# Loaded once, before the port opens, so the first request never pays for it.
MODEL = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3", assemble(), quantization="int8")

# One take at a time: a single run already uses every core it is given, and
# two at once would only make both slower.
TURN = threading.Lock()


class Refused(Exception):
    def __init__(self, status: int, reason: str) -> None:
        super().__init__(reason)
        self.status = status
        self.reason = reason


def read_wav(body: bytes) -> np.ndarray:
    """The take as float samples at 16 kHz, mono."""
    try:
        with wave.open(io.BytesIO(body)) as wav:
            channels = wav.getnchannels()
            width = wav.getsampwidth()
            rate = wav.getframerate()
            frames = wav.readframes(wav.getnframes())
    except (wave.Error, EOFError) as failure:
        raise Refused(400, "The body is not a WAV file.") from failure

    if width != 2:
        raise Refused(415, "Only 16-bit PCM is read here.")

    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    if rate != SAMPLE_RATE and samples.size > 0:
        # The app records at 16 kHz already; this only spares a stray file.
        span = np.arange(0, samples.size, rate / SAMPLE_RATE)
        samples = np.interp(span, np.arange(samples.size), samples).astype(np.float32)

    if samples.size > SAMPLE_RATE * MAX_SECONDS:
        raise Refused(413, "The take is longer than the recorder allows.")

    return samples


class Handler(BaseHTTPRequestHandler):
    server_version = "vidlun-transcriber"
    sys_version = ""

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # No access log: even a path and a size say when someone spoke.
        return

    def answer(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.answer(200, {"ok": True})
        else:
            self.answer(404, {"error": "No such path."})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/transcribe":
            self.answer(404, {"error": "No such path."})
            return

        try:
            length = int(self.headers.get("content-length") or "0")

            if length <= 0 or length > MAX_BYTES:
                raise Refused(413, "The body is empty or larger than a take.")

            samples = read_wav(self.rfile.read(length))
            started = time.monotonic()

            with TURN:
                text = MODEL.recognize(samples, sample_rate=SAMPLE_RATE) if samples.size else ""

            self.answer(
                200,
                {
                    "text": text.strip(),
                    "seconds": round(samples.size / SAMPLE_RATE, 2),
                    "ms": round((time.monotonic() - started) * 1000),
                },
            )
        except Refused as refusal:
            self.answer(refusal.status, {"error": refusal.reason})
        except Exception:  # noqa: BLE001
            # The reason stays out of the response and out of any log: it
            # could quote the input.
            self.answer(500, {"error": "The take could not be read."})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
