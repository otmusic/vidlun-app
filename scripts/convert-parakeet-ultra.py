#!/usr/bin/env python3
"""
Converts Moondream's Parakeet Ultra (Hugging Face safetensors) into the ggml
layout whisper.rn reads — whisper.cpp 1.9.1's `parakeet.cpp` — as f32, for
`parakeet-quantize` to compress. See BACKLOG §1d⁗.

    python3 scripts/convert-parakeet-ultra.py \
        --template assets/model/ggml-parakeet-tdt-0.6b-v3-q8_0.bin \
        --ultra <dir with model.safetensors, tokenizer.json> \
        --out <ultra-f32.bin>

Ultra is NVIDIA's Parakeet TDT 0.6B v3 post-trained: the same architecture,
tokenizer and parameter count, plus a small voice-activity head that only
Moondream's own runtime uses. So the v3 file from ggml-org/parakeet-GGUF is
the template: its header (hyperparameters, mel filterbank, STFT window, TDT
durations, vocabulary) is copied as it is, and its tensor list fixes the
names, shapes and order. Each tensor is filled with Ultra's weights, renamed
from the transformers layout to NeMo's, with the two transforms whisper.cpp's
own `models/convert-parakeet-to-ggml.py` applies: the prediction LSTM's
input bias folded into its hidden bias, and its gates reordered from
PyTorch's [i, f, g, o] to [i, f, o, g].

The checks are what make a conversion by hand trustworthy: Ultra's
vocabulary must equal v3's token for token, every Ultra tensor but the
voice-activity head must be used, and every tensor must stay close to v3's
(cosine similarity) — a wrong name or a wrong gate order shows up there as a
collapse, not as a slightly worse transcript.

Needs numpy and safetensors.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys

import numpy as np
from safetensors.numpy import load_file

GGML_MAGIC = 0x67676D6C
HPARAM_COUNT = 15
FTYPE_INDEX = 6
TDT_DURATIONS_INDEX = 13

# Types the v3 template uses, as (name, block size, bytes per block).
GGML_TYPES = {0: ('f32', 1, 4), 1: ('f16', 1, 2), 8: ('q8_0', 32, 34)}

LSTM = 'decoder.prediction.dec_rnn.lstm.'

# NeMo name (whisper.cpp's) -> transformers name (Ultra's), by substring.
RENAMES = [
    ('encoder.pre_encode.out.', 'encoder.subsampling.linear.'),
    ('encoder.pre_encode.conv.', 'encoder.subsampling.layers.'),
    ('.conv.batch_norm.', '.conv.norm.'),
    ('.self_attn.linear_q.', '.self_attn.q_proj.'),
    ('.self_attn.linear_k.', '.self_attn.k_proj.'),
    ('.self_attn.linear_v.', '.self_attn.v_proj.'),
    ('.self_attn.linear_out.', '.self_attn.o_proj.'),
    ('.self_attn.linear_pos.', '.self_attn.relative_k_proj.'),
    ('.self_attn.pos_bias_u', '.self_attn.bias_u'),
    ('.self_attn.pos_bias_v', '.self_attn.bias_v'),
    ('decoder.prediction.embed.', 'decoder.embedding.'),
    (LSTM, 'decoder.lstm.'),
    ('joint.pred.', 'decoder.decoder_projector.'),
    ('joint.enc.', 'encoder_projector.'),
    ('joint.joint_net.2.', 'joint.head.'),
]

LEFT_OUT = 'vad_head.'
MIN_SIMILARITY = 0.9


class Template:
    """The v3 ggml file, read just far enough to reuse its header and tensor list."""

    def __init__(self, path: str) -> None:
        with open(path, 'rb') as f:
            self.data = f.read()
        self.at = 0
        if self.i32() != GGML_MAGIC:
            raise SystemExit(f'{path} is not a ggml file')
        self.hparams = [self.i32() for _ in range(HPARAM_COUNT)]
        n_mels, n_freqs = self.i32(), self.i32()
        self.at += 4 * n_mels * n_freqs
        # Read before advancing: `self.at += 4 * self.i32()` would lose i32's own step.
        n_window = self.i32()
        self.at += 4 * n_window
        self.at += 4 * self.hparams[TDT_DURATIONS_INDEX]
        n_tokens = self.i32()
        self.tokens = [self.text(self.i32()) for _ in range(n_tokens)]
        self.header_end = self.at
        self.tensors = []
        while self.at < len(self.data):
            n_dims, name_len, ftype = struct.unpack_from('<iii', self.data, self.at)
            self.at += 12
            dims = list(struct.unpack_from('<' + 'i' * n_dims, self.data, self.at))
            self.at += 4 * n_dims
            name = self.text(name_len)
            kind, block, block_bytes = GGML_TYPES[ftype]
            nbytes = int(np.prod(dims)) // block * block_bytes
            self.tensors.append({'name': name, 'dims': dims, 'kind': kind, 'offset': self.at})
            self.at += nbytes

    def i32(self) -> int:
        value = struct.unpack_from('<i', self.data, self.at)[0]
        self.at += 4
        return value

    def text(self, length: int) -> str:
        value = self.data[self.at:self.at + length].decode('utf-8')
        self.at += length
        return value

    def values(self, tensor: dict) -> np.ndarray:
        """The tensor as float32, for comparing against Ultra's."""
        count = int(np.prod(tensor['dims']))
        raw = memoryview(self.data)[tensor['offset']:]
        if tensor['kind'] == 'f32':
            return np.frombuffer(raw[:4 * count], '<f4').astype(np.float64)
        if tensor['kind'] == 'f16':
            return np.frombuffer(raw[:2 * count], '<f2').astype(np.float64)
        blocks = np.frombuffer(raw[:count // 32 * 34], np.uint8).reshape(-1, 34)
        scale = blocks[:, :2].copy().view('<f2').astype(np.float64)
        quants = blocks[:, 2:].copy().view(np.int8).astype(np.float64)
        return (quants * scale).ravel()


def ultra_name(name: str) -> str:
    for nemo, transformers in RENAMES:
        name = name.replace(nemo, transformers)
    return name


def reorder_gates(x: np.ndarray) -> np.ndarray:
    h = x.shape[0] // 4
    return np.concatenate([x[:h], x[h:2 * h], x[3 * h:], x[2 * h:3 * h]], axis=0)


def ultra_tensor(name: str, ultra: dict, used: set) -> np.ndarray:
    """Ultra's weights for one of v3's tensors, in v3's convention."""
    if name.startswith(LSTM + 'bias_h_l'):
        layer = name.rsplit('bias_h_l', 1)[1]
        hidden, given = f'decoder.lstm.bias_hh_l{layer}', f'decoder.lstm.bias_ih_l{layer}'
        used.update([hidden, given])
        return reorder_gates(ultra[hidden].astype(np.float32) + ultra[given].astype(np.float32))

    source = ultra_name(name)
    used.add(source)
    x = ultra[source].astype(np.float32)
    # Conv2d weights keep all four dimensions, as the official converter keeps them.
    if not ('conv' in name and 'weight' in name and x.ndim == 4):
        x = x.squeeze()
    if name.startswith(LSTM):
        x = reorder_gates(x)
    return x


def check_vocabulary(template: Template, ultra_dir: str) -> None:
    with open(f'{ultra_dir}/tokenizer.json', encoding='utf-8') as f:
        vocab = json.load(f)['model']['vocab']
    tokens = [v[0] for v in vocab] if isinstance(vocab, list) else sorted(vocab, key=vocab.get)
    if tokens != template.tokens:
        raise SystemExit("Ultra's vocabulary differs from v3's; the template's header does not fit it.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--template', required=True, help='ggml-parakeet-tdt-0.6b-v3-q8_0.bin')
    parser.add_argument('--ultra', required=True, help='directory with model.safetensors and tokenizer.json')
    parser.add_argument('--out', required=True, help='the f32 ggml file to write')
    args = parser.parse_args()

    template = Template(args.template)
    check_vocabulary(template, args.ultra)
    ultra = load_file(f'{args.ultra}/model.safetensors')
    used: set = set()
    similarities = []

    with open(args.out, 'wb') as out:
        header = bytearray(template.data[:template.header_end])
        # f32 throughout: parakeet-quantize keeps whatever it cannot quantise
        # in the source type, and the loader expects those tensors as f32.
        struct.pack_into('<i', header, 4 + FTYPE_INDEX * 4, 0)
        out.write(header)

        for tensor in template.tensors:
            shape = list(reversed(tensor['dims']))
            x = ultra_tensor(tensor['name'], ultra, used)
            if x.size != int(np.prod(shape)):
                raise SystemExit(f"{tensor['name']}: Ultra has {x.shape}, v3 has {shape}")
            x = x.reshape(shape).astype(np.float32)

            name = tensor['name'].encode('utf-8')
            out.write(struct.pack('<iii', len(tensor['dims']), len(name), 0))
            out.write(struct.pack('<' + 'i' * len(tensor['dims']), *tensor['dims']))
            out.write(name)
            out.write(x.tobytes())

            reference, mine = template.values(tensor), x.astype(np.float64).ravel()
            norms = np.linalg.norm(reference) * np.linalg.norm(mine)
            similarity = float(reference @ mine / norms) if norms > 0 else float(np.allclose(reference, mine))
            similarities.append((similarity, tensor['name']))

    unused = sorted(name for name in set(ultra) - used if not name.startswith(LEFT_OUT))
    if unused:
        raise SystemExit(f'Ultra tensors with no place in the v3 layout: {unused}')

    similarities.sort()
    lowest, where = similarities[0]
    print(f'{len(similarities)} tensors written; lowest similarity to v3 {lowest:.4f} ({where})')
    if lowest < MIN_SIMILARITY:
        raise SystemExit('A tensor is far from v3: a rename or the gate order is wrong.')


if __name__ == '__main__':
    sys.exit(main())
