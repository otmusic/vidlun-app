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
 * What the app runs: NVIDIA Parakeet TDT 0.6B v3, the 4-bit file. Measured
 * level with the 8-bit one on the labelled takes (BACKLOG §1c, 2026-09-16)
 * at 356 MB against 669, and every megabyte here is one every install
 * carries — the English speakers' included, since one model reads every
 * language the journal is spoken in.
 */
export const PARAKEET_TDT_Q4_0: SpeechModelDescriptor = {
  fileName: 'ggml-parakeet-tdt-0.6b-v3-q4_0.bin',
  engine: 'parakeet',
};

/** The one the app reads with. Swapping engines is this line — and the file the build plugin bundles. */
export const SPEECH_MODEL: SpeechModelDescriptor = PARAKEET_TDT_Q4_0;
