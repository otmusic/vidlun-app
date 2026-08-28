import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import {
  CLOUD_CONFIDENCE,
  CloudTranscriptionError,
  GEMINI_INTERACTIONS_URL,
  GEMINI_TRANSCRIPTION_MODEL,
  GeminiTranscriptionService,
  type EncodedAudio,
  type HttpResponse,
  type PostJson,
} from '@/infrastructure/transcription/GeminiTranscriptionService';

const TAKE: AudioRecording = { uri: 'file:///takes/one.wav', durationMs: 12_000 };

function answering(payload: string, status = 200): HttpResponse {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(payload) };
}

function completed(text: string): string {
  return JSON.stringify({
    id: 'interactions/abc123xyz',
    status: 'completed',
    steps: [{ id: 'step_001', type: 'model_output', content: [{ type: 'text', text }] }],
  });
}

function audio(byteLength = 4096): EncodedAudio {
  return { base64: 'AAAA', byteLength };
}

interface SentRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

function recording(response: HttpResponse): { post: PostJson; sent: SentRequest[] } {
  const sent: SentRequest[] = [];

  return {
    sent,
    post: (url, headers, body) => {
      sent.push({ url, headers, body });

      return Promise.resolve(response);
    },
  };
}

describe('GeminiTranscriptionService', () => {
  it('sends the take as inline audio with the key and the model', async () => {
    const { post, sent } = recording(answering(completed('I am tired but it went well')));
    const service = new GeminiTranscriptionService('key-123', () => Promise.resolve(audio()), post);

    await service.transcribe(TAKE);

    const request = sent[0];

    expect(request?.url).toBe(GEMINI_INTERACTIONS_URL);
    expect(request?.headers['x-goog-api-key']).toBe('key-123');
    expect(JSON.parse(request?.body ?? '{}')).toEqual({
      model: GEMINI_TRANSCRIPTION_MODEL,
      input: [{ type: 'audio', data: 'AAAA', mime_type: 'audio/wav' }],
      generation_config: {
        transcription_config: { mode: { type: 'verbatim' }, language_codes: [] },
      },
    });
  });

  it('names the languages this person speaks, when the app knows them', async () => {
    const { post, sent } = recording(answering(completed('anything')));
    const service = new GeminiTranscriptionService(
      'key',
      () => Promise.resolve(audio()),
      post,
      { languageCodes: ['uk-UA', 'ru-RU'] },
    );

    await service.transcribe(TAKE);

    expect(sent[0]?.body).toContain('"language_codes":["uk-UA","ru-RU"]');
  });

  it('names the Android container by its own mime type', async () => {
    const { post, sent } = recording(answering(completed('anything')));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await service.transcribe({ uri: 'file:///takes/one.m4a', durationMs: 9_000 });

    expect(sent[0]?.body).toContain('audio/aac');
  });

  it('reads the transcript out of the steps', async () => {
    const { post } = recording(answering(completed('  the day was long  ')));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).resolves.toEqual({
      text: 'the day was long',
      confidence: CLOUD_CONFIDENCE,
    });
  });

  it('prefers the flat transcript when the response carries one', async () => {
    const { post } = recording(
      answering(JSON.stringify({ output_text: 'flat', steps: [{ content: [{ text: 'nested' }] }] })),
    );
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).resolves.toEqual({
      text: 'flat',
      confidence: CLOUD_CONFIDENCE,
    });
  });

  it('reports no confidence in a transcript with nothing in it', async () => {
    const { post } = recording(answering(completed('')));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).resolves.toEqual({ text: '', confidence: 0 });
  });

  it('fails on a rejected request rather than returning an empty take', async () => {
    const { post } = recording(answering('{"error":{"message":"API key not valid"}}', 400));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).rejects.toBeInstanceOf(CloudTranscriptionError);
  });

  it('fails on a body that carries no transcript', async () => {
    const { post } = recording(answering('{"id":"interactions/1"}'));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).rejects.toBeInstanceOf(CloudTranscriptionError);
  });

  it('carries the reason forward when the service explains itself', async () => {
    const { post } = recording(answering(JSON.stringify({ error: { message: 'quota exceeded' } })));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await expect(service.transcribe(TAKE)).rejects.toThrow('quota exceeded');
  });

  it('turns a dropped connection into a cloud failure', async () => {
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), () =>
      Promise.reject(new Error('Network request failed')),
    );

    await expect(service.transcribe(TAKE)).rejects.toBeInstanceOf(CloudTranscriptionError);
  });

  it('refuses a take too large to fit one request, without sending it', async () => {
    const { post, sent } = recording(answering(completed('never read')));
    const service = new GeminiTranscriptionService(
      'key',
      () => Promise.resolve(audio(20 * 1024 * 1024)),
      post,
    );

    await expect(service.transcribe(TAKE)).rejects.toBeInstanceOf(CloudTranscriptionError);
    expect(sent).toHaveLength(0);
  });

  it('gives up on a service that never answers', async () => {
    const service = new GeminiTranscriptionService(
      'key',
      () => Promise.resolve(audio()),
      (_url, _headers, _body, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('Aborted'));
          });
        }),
      { timeoutMs: 5 },
    );

    await expect(service.transcribe(TAKE)).rejects.toBeInstanceOf(CloudTranscriptionError);
  });

  it('has nothing to get ready', async () => {
    const { post, sent } = recording(answering(completed('unused')));
    const service = new GeminiTranscriptionService('key', () => Promise.resolve(audio()), post);

    await service.prepare();

    expect(sent).toHaveLength(0);
  });
});
