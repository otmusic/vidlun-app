import { NoRecordingProducedError, RecordingCancelledError } from '@/domain/errors/RecordingErrors';
import { ExpoAudioRecorder, type RecordingLimits } from '@/infrastructure/audio/ExpoAudioRecorder';
import { FakeNativeRecorder, ManualScheduler } from './fakes';

const OPTIONS: RecordingLimits = {
  maxDurationMs: 1000,
  pollIntervalMs: 100,
};

const SPEECH = -20;

function setup() {
  const recorder = new FakeNativeRecorder();
  const scheduler = new ManualScheduler();
  const audioSession: string[] = [];

  const enableRecordingMode = (): Promise<void> => {
    audioSession.push('enabled');

    return Promise.resolve();
  };

  return {
    recorder,
    scheduler,
    audioSession,
    subject: new ExpoAudioRecorder(recorder, enableRecordingMode, scheduler, OPTIONS),
  };
}

/**
 * Lets `start()` finish its awaits so the take is live and the scheduler is
 * subscribed. Drains several ticks rather than one, so adding an await inside
 * `start()` does not silently break every test in this file.
 */
async function live(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await Promise.resolve();
  }
}

/** Drives the take forward one poll at a time at the given loudness. */
function play(
  recorder: FakeNativeRecorder,
  scheduler: ManualScheduler,
  metering: number | undefined,
  polls: number,
): void {
  for (let count = 0; count < polls; count += 1) {
    recorder.emit(metering, OPTIONS.pollIntervalMs);
    scheduler.advance();
  }
}

describe('ExpoAudioRecorder', () => {
  it('enables metering, which the recording screen draws the voice from', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    expect(recorder.prepareCalls).toBe(1);

    subject.stop();
    await take;
    expect(scheduler.watching).toBe(0);
  });

  it('keeps recording through a long silence, because a pause is not an ending', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    play(recorder, scheduler, -60, 6);

    expect(recorder.stopCalls).toBe(0);

    subject.stop();
    await expect(take).resolves.toMatchObject({ durationMs: 800 });
  });

  it('stops at the ceiling so a forgotten recording cannot run all day', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 10);

    await expect(take).resolves.toMatchObject({ durationMs: 1000 });
  });

  it('runs to the ceiling when the device reports no metering at all', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, undefined, 5);

    expect(recorder.stopCalls).toBe(0);

    play(recorder, scheduler, undefined, 5);

    await expect(take).resolves.toMatchObject({ durationMs: 1000 });
  });

  it('ends the take when the user taps stop', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    subject.stop();

    await expect(take).resolves.toMatchObject({ durationMs: 200 });
    expect(recorder.stopCalls).toBe(1);
  });

  it('throws the take away when the user cancels', async () => {
    const { scheduler, subject } = setup();
    const take = subject.start();

    await live();
    subject.cancel();

    await expect(take).rejects.toThrow(RecordingCancelledError);
    expect(scheduler.watching).toBe(0);
  });

  it('reports a take that produced no file', async () => {
    const { recorder, subject } = setup();

    recorder.uri = null;

    const take = subject.start();

    await live();
    subject.stop();

    await expect(take).rejects.toThrow(NoRecordingProducedError);
  });

  it('surfaces a failure from the native recorder', async () => {
    const { recorder, subject } = setup();

    recorder.stopFailure = new Error('microphone was taken by a call');

    const take = subject.start();

    await live();
    subject.stop();

    await expect(take).rejects.toThrow('microphone was taken by a call');
  });

  it('does nothing when stopped before a take was ever started', () => {
    const { recorder, subject } = setup();

    subject.stop();
    subject.cancel();

    expect(recorder.stopCalls).toBe(0);
  });
});

describe('the iOS audio session', () => {
  it('opens the session for recording before touching the recorder', async () => {
    const { recorder, subject, audioSession } = setup();
    const order: string[] = [];

    recorder.onPrepare = () => order.push('prepare');

    const take = subject.start();

    await live();

    expect(audioSession).toEqual(['enabled']);
    expect(order).toEqual(['prepare']);

    subject.cancel();
    await expect(take).rejects.toThrow(RecordingCancelledError);
  });

  it('gives up the take when the session refuses to open', async () => {
    const recorder = new FakeNativeRecorder();
    const scheduler = new ManualScheduler();
    const refused = new Error('Recording not allowed on iOS');
    const subject = new ExpoAudioRecorder(recorder, () => Promise.reject(refused), scheduler, OPTIONS);

    await expect(subject.start()).rejects.toThrow(refused);
    expect(recorder.prepareCalls).toBe(0);
  });
});
