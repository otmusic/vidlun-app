import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';

/** Gemini's non-streaming transcription endpoint. */
export const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Gemini 3.5 Transcribe. 85+ languages, `uk-UA` and `ru-RU` among them, and
 * code-switching inside one utterance — which is what §1's audience does and
 * what every specialised Ukrainian model fails at. See BACKLOG §1d.
 */
export const GEMINI_TRANSCRIPTION_MODEL = 'gemini-3.5-transcribe';

/**
 * Asserted, not measured. The duration bands the on-device service uses come
 * from Whisper's error curve and mean nothing here; a recogniser at 2.6% word
 * error rate has no band where the transcript should be distrusted by length.
 * BACKLOG 1.7 covers measuring both.
 */
export const CLOUD_CONFIDENCE = 0.9;

/**
 * The whole request may not exceed 20 MB, and base64 costs a third on top of
 * the bytes. Past this the take goes to the phone instead — at 32 KB/s of WAV
 * the recorder's own five-minute ceiling arrives first, so this is a guard
 * against a future recording format rather than a limit anyone will meet.
 */
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;

/**
 * Long enough for a slow connection to finish a megabyte, short enough that
 * giving up and running Parakeet still beats waiting. The fallback costs about
 * two seconds, so waiting longer than this for the cloud buys nothing.
 */
const DEFAULT_TIMEOUT_MS = 12_000;

/** iOS records WAV, Android AAC in an MP4 container. Both are on Gemini's list. */
const MIME_TYPES: Readonly<Record<string, string>> = {
  wav: 'audio/wav',
  m4a: 'audio/aac',
  aac: 'audio/aac',
  mp3: 'audio/mp3',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
};

/** A take's bytes in the shape the API takes them. */
export interface EncodedAudio {
  readonly base64: string;
  /** Bytes before encoding, which is what the size guard is written against. */
  readonly byteLength: number;
}

/**
 * Reading the file is the one thing here that needs the platform, so it comes
 * in from outside and this adapter stays testable in plain Node.
 */
export type ReadAudio = (uri: string) => Promise<EncodedAudio>;

/** The slice of a fetch response this adapter reads. */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

/** The seam the request goes through, injected for the same reason. */
export type PostJson = (
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string,
  signal: AbortSignal,
) => Promise<HttpResponse>;

export const postJson: PostJson = (url, headers, body, signal) =>
  fetch(url, { method: 'POST', headers, body, signal });

/**
 * Everything the caller should answer by transcribing on the phone instead: no
 * connection, a timeout, a rejected key, a body that made no sense. Not a
 * `DomainError` — no rule was broken, the network simply was not there.
 */
export class CloudTranscriptionError extends Error {
  constructor(detail: string) {
    super(`Cloud transcription did not answer: ${detail}`);
    this.name = 'CloudTranscriptionError';
  }
}

export interface CloudTranscriptionOptions {
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly maxAudioBytes?: number;
  /**
   * BCP-47 codes for the languages this person speaks. Hints, not a filter:
   * code-switching survives either way, and naming the languages is documented
   * to raise accuracy. Empty means the model decides alone, which is right
   * when the app does not know.
   */
  readonly languageCodes?: readonly string[];
  /**
   * `verbatim` returns what was said, disfluencies included. `smart` rewrites
   * for readability — it removes fillers and repairs self-corrections, which
   * is work the analyzer prompt already does under rules written for this
   * audience. Verbatim ships; the option exists so the benchmark can put a
   * number on what the other one would change.
   */
  readonly mode?: 'verbatim' | 'smart';
}

/**
 * Transcription by Gemini, for the takes made while there is a connection.
 *
 * It is never the only recogniser: every failure here is a signal to fall back
 * to the phone, which is why nothing in this class retries or degrades on its
 * own. `CloudFirstTranscriptionService` owns that decision.
 *
 * Smart mode — Gemini's own filler-word removal and self-correction repair —
 * is deliberately off. The analyzer prompt already repairs the transcript
 * under rules written for this audience: a Russian word inside a Ukrainian
 * sentence is how the person talks and must survive. Two repairs in a row,
 * one of them not ours to tune, is how someone's words quietly become someone
 * else's. Worth measuring against (BACKLOG 1.8), not worth assuming.
 */
export class GeminiTranscriptionService implements ITranscriptionService {
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxAudioBytes: number;
  private readonly languageCodes: readonly string[];
  private readonly mode: 'verbatim' | 'smart';

  constructor(
    private readonly apiKey: string,
    private readonly readAudio: ReadAudio,
    private readonly post: PostJson = postJson,
    options: CloudTranscriptionOptions = {},
  ) {
    this.model = options.model ?? GEMINI_TRANSCRIPTION_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAudioBytes = options.maxAudioBytes ?? MAX_AUDIO_BYTES;
    this.languageCodes = options.languageCodes ?? [];
    this.mode = options.mode ?? 'verbatim';
  }

  /** Nothing to open: the model is not on this device. */
  prepare(): Promise<void> {
    return Promise.resolve();
  }

  async transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    const audio = await this.readAudio(recording.uri);

    if (audio.byteLength > this.maxAudioBytes) {
      throw new CloudTranscriptionError(
        `the take is ${audio.byteLength} bytes, past what one request carries`,
      );
    }

    const text = await this.ask(audio, mimeTypeFor(recording.uri));

    // Zero rather than the flat score: a transcript with nothing in it is not
    // a confident anything, and the caller reads this to decide whether to ask
    // the phone as well.
    return { text, confidence: text.length === 0 ? 0 : CLOUD_CONFIDENCE };
  }

  private async ask(audio: EncodedAudio, mimeType: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.post(
        GEMINI_INTERACTIONS_URL,
        {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        JSON.stringify({
          model: this.model,
          /*
           * Inline bytes rather than an upload through the Files API: a take is
           * one to two megabytes and a second round trip costs more than it
           * saves on the capture path.
           */
          input: [{ type: 'audio', data: audio.base64, mime_type: mimeType }],
          /*
           * Verbatim is stated rather than left to the default, so nobody has
           * to remember which one that is: this transcript is already rewritten
           * once downstream, and with two rewriters a wrong word has no author.
           */
          generation_config: {
            transcription_config: {
              mode: this.mode === 'smart' ? 'smart' : { type: 'verbatim' },
              language_codes: this.languageCodes,
            },
          },
        }),
        controller.signal,
      );

      if (!response.ok) {
        throw new CloudTranscriptionError(`the service answered ${response.status}`);
      }

      return readTranscript(await response.text());
    } catch (error) {
      if (error instanceof CloudTranscriptionError) {
        throw error;
      }

      // An abort, a DNS failure and a dropped socket all arrive here, and all
      // three mean the same thing to the caller: use the phone.
      throw new CloudTranscriptionError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** WAV when the name says nothing, because that is what the recorder writes. */
function mimeTypeFor(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase() ?? '';

  return MIME_TYPES[extension] ?? MIME_TYPES['wav'] ?? 'audio/wav';
}

/**
 * The transcript sits in `output_text`, and the same words are spread across
 * the steps for callers that want the structure. Either is read, because a
 * shape that changed under us must fail loudly rather than return half a
 * sentence.
 */
function readTranscript(payload: string): string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new CloudTranscriptionError('the response was not JSON');
  }

  const body = asRecord(parsed);

  if (body === null) {
    throw new CloudTranscriptionError('the response was not an object');
  }

  const failure = asRecord(body['error']);

  if (failure !== null) {
    const message = failure['message'];

    throw new CloudTranscriptionError(typeof message === 'string' ? message : 'no reason given');
  }

  const direct = body['output_text'];

  if (typeof direct === 'string') {
    return direct.trim();
  }

  const steps = body['steps'];

  if (!Array.isArray(steps)) {
    throw new CloudTranscriptionError('the response carried no transcript');
  }

  return steps
    .map((step: unknown) => textOfStep(step))
    .filter((text) => text.length > 0)
    .join(' ')
    .trim();
}

function textOfStep(step: unknown): string {
  const content = asRecord(step)?.['content'];

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((block: unknown) => {
      const text = asRecord(block)?.['text'];

      return typeof text === 'string' ? text : '';
    })
    .join('')
    .trim();
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
