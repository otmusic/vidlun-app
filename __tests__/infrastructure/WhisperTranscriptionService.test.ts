import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import {
  DEFAULT_SPEECH_THRESHOLDS,
  WhisperTranscriptionService,
  type WhisperEngine,
} from '@/infrastructure/transcription/WhisperTranscriptionService';

class FakeEngine implements WhisperEngine {
  calls: { path: string; language: string | undefined }[] = [];
  result = 'finished three tasks happy but very tired';
  isAborted = false;

  transcribe(filePath: string, options?: { readonly language?: string }) {
    this.calls.push({ path: filePath, language: options?.language });

    return { promise: Promise.resolve({ result: this.result, isAborted: this.isAborted }) };
  }
}

function take(durationMs: number): AudioRecording {
  return { uri: 'file:///take.wav', durationMs };
}

function setup(language = 'uk') {
  const engine = new FakeEngine();

  return { engine, subject: new WhisperTranscriptionService(() => Promise.resolve(engine), () => language) };
}

describe('choosing a language for the model', () => {
  it('lets the model detect when the take is long enough to detect from', async () => {
    const { engine, subject } = setup();

    await subject.transcribe(take(DEFAULT_SPEECH_THRESHOLDS.detectableFromMs));

    expect(engine.calls[0]?.language).toBe('auto');
  });

  it("falls back to the user's own language when the take is too short", async () => {
    const { engine, subject } = setup('uk');

    await subject.transcribe(take(1_500));

    expect(engine.calls[0]?.language).toBe('uk');
  });

  it('follows the user rather than a value fixed at construction', async () => {
    const engine = new FakeEngine();
    let language = 'uk';
    const subject = new WhisperTranscriptionService(() => Promise.resolve(engine), () => language);

    await subject.transcribe(take(1_000));
    language = 'ru';
    await subject.transcribe(take(1_000));

    expect(engine.calls.map((call) => call.language)).toEqual(['uk', 'ru']);
  });
});

describe('confidence, which nothing in whisper.rn reports', () => {
  it.each([
    ['a take long enough to have held up under measurement', 'high', 9_000],
    ['a take in the middle band', 'medium', 5_000],
    ['a take too short for the model to place', 'low', 2_000],
  ])('reads %s as %s', async (_label, level, durationMs) => {
    const { subject } = setup();
    const { confidence } = await subject.transcribe(take(durationMs));

    const actual = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

    expect(actual).toBe(level);
  });
});

describe('what the model returns', () => {
  it('drops the marker whisper writes when it heard nothing', async () => {
    const { engine, subject } = setup();
    engine.result = '[BLANK_AUDIO]';

    expect((await subject.transcribe(take(9_000))).text).toBe('');
  });

  it('keeps the words around a marker instead of losing the take', async () => {
    const { engine, subject } = setup();
    engine.result = 'cooked dinner [BLANK_AUDIO]';

    expect((await subject.transcribe(take(9_000))).text).toBe('cooked dinner');
  });

  it('reports nothing at all for a take the user cancelled', async () => {
    const { engine, subject } = setup();
    engine.isAborted = true;
    engine.result = 'half a sen';

    expect(await subject.transcribe(take(9_000))).toEqual({ text: '', confidence: 0 });
  });

  it('passes the recording through untouched', async () => {
    const { engine, subject } = setup();

    await subject.transcribe(take(9_000));

    expect(engine.calls[0]?.path).toBe('file:///take.wav');
  });
});
