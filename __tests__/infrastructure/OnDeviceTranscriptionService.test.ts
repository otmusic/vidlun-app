import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import {
  DEFAULT_SPEECH_THRESHOLDS,
  OnDeviceTranscriptionService,
  type SpeechEngine,
} from '@/infrastructure/transcription/OnDeviceTranscriptionService';

class FakeEngine implements SpeechEngine {
  calls: { path: string; language: string | undefined }[] = [];
  result = 'finished three tasks happy but very tired';
  isAborted = false;

  transcribe(filePath: string, options?: { readonly language?: string }) {
    this.calls.push({ path: filePath, language: options?.language });

    return { promise: Promise.resolve({ result: this.result, isAborted: this.isAborted }) };
  }

  released = 0;

  release(): Promise<void> {
    this.released += 1;

    return Promise.resolve();
  }
}

function take(durationMs: number): AudioRecording {
  return { uri: 'file:///take.wav', durationMs };
}

function setup(language = 'uk') {
  const engine = new FakeEngine();

  return { engine, subject: new OnDeviceTranscriptionService(() => Promise.resolve(engine), () => language) };
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
    const subject = new OnDeviceTranscriptionService(() => Promise.resolve(engine), () => language);

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

describe('letting the model go when the app leaves the front', () => {
  it('frees an open model, and the next take opens it again', async () => {
    const engines: FakeEngine[] = [];
    const subject = new OnDeviceTranscriptionService(() => {
      const engine = new FakeEngine();

      engines.push(engine);

      return Promise.resolve(engine);
    }, () => 'uk');

    await subject.prepare();
    await subject.release();
    await subject.transcribe(take(9_000));

    expect(engines.map((engine) => engine.released)).toEqual([1, 0]);
    expect(engines[1]?.calls).toHaveLength(1);
  });

  it('waits for a transcription under way before freeing the model', async () => {
    let finish: (value: { result: string; isAborted: boolean }) => void = () => undefined;
    const engine = new FakeEngine();

    engine.transcribe = () => ({
      promise: new Promise((resolve) => {
        finish = resolve;
      }),
    });

    const subject = new OnDeviceTranscriptionService(() => Promise.resolve(engine), () => 'uk');
    const running = subject.transcribe(take(9_000));

    await Promise.resolve();
    await subject.release();

    expect(engine.released).toBe(0);

    finish({ result: 'words', isAborted: false });
    await running;
    await Promise.resolve();

    expect(engine.released).toBe(1);
  });

  it('does nothing when no model was ever opened', async () => {
    const opened: number[] = [];
    const subject = new OnDeviceTranscriptionService(() => {
      opened.push(1);

      return Promise.resolve(new FakeEngine());
    }, () => 'uk');

    await subject.release();

    expect(opened).toHaveLength(0);
  });
});
