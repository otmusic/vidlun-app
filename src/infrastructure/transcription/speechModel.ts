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

/**
 * The one the app reads with — the owner's choice after a day with q4_0 on
 * the phone. Swapping is this line, the file `scripts/fetch-model.sh`
 * brings, and the file app.json hands the build plugin.
 */
export const SPEECH_MODEL: SpeechModelDescriptor = PARAKEET_TDT_Q4_K;
