# Parakeet Ultra on CPU, for the proxy's /v1/transcribe (owner's word,
# 2026-11-10). Built by wrangler for linux/amd64; see server/README.md.

# The model, fetched once at build time from a pinned commit and checked
# byte for byte, so nothing is downloaded while a person is waiting.
FROM python:3.12-slim AS model
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /model
# Masterx/parakeet-tdt-0.6b-ultra-onnx: the onnx-asr graphs of
# nvidia/parakeet-tdt-0.6b-v3 carrying moondream/parakeet-ultra's weights.
# CC-BY-4.0, as both of those.
ARG REPO=https://huggingface.co/Masterx/parakeet-tdt-0.6b-ultra-onnx/resolve/99b09f030a5a6efeaa13cf2cf54592100ce2c3f1
RUN for file in encoder-model.int8.onnx decoder_joint-model.int8.onnx vocab.txt config.json; do \
      curl -fsSL --retry 3 -o "$file" "$REPO/$file"; \
    done
COPY model.sha256 .
RUN sha256sum -c model.sha256 && rm model.sha256
# Cut into pieces of about 110 MB, each its own layer: Cloudflare's registry
# drops an upload that runs too long, and the whole encoder as one layer
# never finished (2026-11-11). server.py joins them again at start.
RUN split -b 110m -d encoder-model.int8.onnx encoder-model.int8.onnx.part- \
 && rm encoder-model.int8.onnx \
 && ls encoder-model.int8.onnx.part-* | wc -l | grep -qx 6

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY --from=model /model/encoder-model.int8.onnx.part-00 /model/
COPY --from=model /model/encoder-model.int8.onnx.part-01 /model/
COPY --from=model /model/encoder-model.int8.onnx.part-02 /model/
COPY --from=model /model/encoder-model.int8.onnx.part-03 /model/
COPY --from=model /model/encoder-model.int8.onnx.part-04 /model/
COPY --from=model /model/encoder-model.int8.onnx.part-05 /model/
COPY --from=model /model/decoder_joint-model.int8.onnx /model/vocab.txt /model/config.json /model/
COPY server.py /app/server.py
# Nothing in here needs to write anywhere, so nothing runs as root.
USER nobody
EXPOSE 8080
CMD ["python", "/app/server.py"]
