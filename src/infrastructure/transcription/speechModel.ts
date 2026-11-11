/**
 * The weights the app ships with, and which of whisper.rn's two engines
 * reads them. Since 1.2 the file rides inside the app bundle: 1.0 and 1.1
 * downloaded it — from an Apple-hosted asset pack, then from Hugging Face —
 * and the first afternoon on sale showed what a download step costs when
 * the store's side of it is not there. See BACKLOG §3q.
 */
export interface SpeechModelDescriptor {
  readonly fileName: string;
  readonly engine: 'whisper' | 'parakeet';
}

/**
 * Whisper, kept for comparison rather than use. Its Ukrainian was the reason
 * §10 nearly stopped the project; see BACKLOG §1b and §1c.
 */
export const TURBO_Q5_0: SpeechModelDescriptor = {
  fileName: 'ggml-large-v3-turbo-q5_0.bin',
  engine: 'whisper',
};

/**
 * NVIDIA Parakeet TDT 0.6B v3 in its two 4-bit files. Both measured level
 * with the 8-bit one on the labelled takes (BACKLOG §1c, 2026-09-16):
 * q4_0 at 356 MB, q4_k at 416 MB with the better Ukrainian mean. Every
 * megabyte here is one every install carries — the English speakers'
 * included, since one model reads every language the journal is spoken in.
 */
export const PARAKEET_TDT_Q4_0: SpeechModelDescriptor = {
  fileName: 'ggml-parakeet-tdt-0.6b-v3-q4_0.bin',
  engine: 'parakeet',
};

export const PARAKEET_TDT_Q4_K: SpeechModelDescriptor = {
  fileName: 'ggml-parakeet-tdt-0.6b-v3-q4_k.bin',
  engine: 'parakeet',
};

/** The 8-bit file, 669 MB: what 1.0 to 1.9 ran. */
export const PARAKEET_TDT_Q8_0: SpeechModelDescriptor = {
  fileName: 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin',
  engine: 'parakeet',
};

/**
 * Moondream's Parakeet Ultra — v3 post-trained, same architecture and
 * vocabulary — converted here to whisper.rn's layout and quantised to
 * 4 bits (BACKLOG §1d⁗; `scripts/convert-parakeet-ultra.py`). 356 MB. On
 * the owner's own takes it was the best of six files, the 8-bit v3
 * included: it kept phrases v3 dropped. It writes numbers as digits.
 */
export const PARAKEET_ULTRA_Q4_0: SpeechModelDescriptor = {
  fileName: 'ggml-parakeet-ultra-0.6b-q4_0.bin',
  engine: 'parakeet',
};

/**
 * The one the app reads with — Ultra at 4 bits since 1.10 (owner's word,
 * 2026-11-11), q8_0 before. Swapping is this line, the file
 * `scripts/fetch-model.sh` makes, the file app.json hands the build plugin,
 * and the resource reference in the Xcode project.
 */
export const SPEECH_MODEL: SpeechModelDescriptor = PARAKEET_ULTRA_Q4_0;
