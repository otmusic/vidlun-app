import { NoRecordingProducedError, RecordingCancelledError } from '@/domain/errors/RecordingErrors';
import {
  ExpoAudioRecorder,
  levelFromDecibels,
  type RecordingLimits,
  type ScreenAwake,
} from '@/infrastructure/audio/ExpoAudioRecorder';
import { FakeNativeRecorder, ManualScheduler } from './fakes';

const OPTIONS: RecordingLimits = {
  maxDurationMs: 1000,
  pollIntervalMs: 100,
};

const SPEECH = -20;

/** What the recorder asked of the screen, in order. */
class FakeScreen implements ScreenAwake {
  readonly asked: string[] = [];

  keepOn(): void {
    this.asked.push('on');
  }

  letSleep(): void {
    this.asked.push('sleep');
  }

  get awake(): boolean {
    return this.asked.at(-1) === 'on';
  }
}

function setup() {
  const recorder = new FakeNativeRecorder();
  const scheduler = new ManualScheduler();
  const audioSession: string[] = [];
  const screen = new FakeScreen();
  /** Each removed take's file, with how many times the recorder had stopped by then. */
  const removed: { uri: string; afterStops: number }[] = [];

  const setRecordingMode = (allowed: boolean): Promise<void> => {
    audioSession.push(allowed ? 'enabled' : 'disabled');

    return Promise.resolve();
  };

  const removeTake = (uri: string): void => {
    removed.push({ uri, afterStops: recorder.stopCalls });
  };

  return {
    recorder,
    scheduler,
    audioSession,
    screen,
    removed,
    subject: new ExpoAudioRecorder(recorder, setRecordingMode, scheduler, screen, removeTake, OPTIONS),
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

  it('holds a paused take and goes on into the same one', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    await subject.pause();
    play(recorder, scheduler, SPEECH, 3);

    expect(recorder.getStatus().isRecording).toBe(false);
    expect(recorder.stopCalls).toBe(0);

    await subject.resume();
    play(recorder, scheduler, SPEECH, 2);
    subject.stop();

    await expect(take).resolves.toMatchObject({ durationMs: 400 });
    expect(recorder.prepareCalls).toBe(1);
  });

  it('throws a paused take away when the person leaves', async () => {
    const { subject } = setup();
    const take = subject.start();

    await live();
    await subject.pause();
    subject.cancel();

    await expect(take).rejects.toThrow(RecordingCancelledError);
  });

  it('does nothing when stopped before a take was ever started', () => {
    const { recorder, subject } = setup();

    subject.stop();
    subject.cancel();

    expect(recorder.stopCalls).toBe(0);
  });
});

describe('how loud the voice is, for the bars', () => {
  it('spreads the speaking range over the bars, so a soft voice still moves them', () => {
    expect(levelFromDecibels(-50)).toBe(0);
    expect(levelFromDecibels(-31)).toBeCloseTo(0.5);
    expect(levelFromDecibels(-12)).toBe(1);
  });

  it('keeps a shout and a silent room inside the range', () => {
    expect(levelFromDecibels(-3)).toBe(1);
    expect(levelFromDecibels(-160)).toBe(0);
  });

  it('reads no meter as nothing heard', () => {
    expect(levelFromDecibels(undefined)).toBe(0);
    expect(levelFromDecibels(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('follows the voice while the take listens', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 1);
    expect(subject.level()).toBeCloseTo(levelFromDecibels(SPEECH));

    subject.stop();
    await take;
  });

  it('is silent before a take, while one is held, and after it ends', async () => {
    const { recorder, scheduler, subject } = setup();

    expect(subject.level()).toBe(0);

    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 1);
    await subject.pause();
    expect(subject.level()).toBe(0);

    await subject.resume();
    subject.stop();
    await take;
    expect(subject.level()).toBe(0);
  });
});

describe('a take the system interrupts', () => {
  it('notices when a call takes the microphone from a take nobody paused', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    expect(subject.interrupted()).toBe(false);

    recorder.interruptBySystem();
    play(recorder, scheduler, SPEECH, 1);

    expect(subject.interrupted()).toBe(true);
    expect(subject.level()).toBe(0);

    subject.stop();
    await take;
  });

  it('keeps what was said before the call and goes on into the same take', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    recorder.interruptBySystem();
    play(recorder, scheduler, SPEECH, 3);

    await subject.pause();
    expect(subject.interrupted()).toBe(false);

    await subject.resume();
    play(recorder, scheduler, SPEECH, 2);
    expect(subject.interrupted()).toBe(false);

    subject.stop();
    await expect(take).resolves.toMatchObject({ durationMs: 400 });
  });

  it('does not take its own pause for an interruption', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 2);
    await subject.pause();
    play(recorder, scheduler, SPEECH, 3);

    expect(subject.interrupted()).toBe(false);

    subject.cancel();
    await expect(take).rejects.toThrow(RecordingCancelledError);
  });

  it('waits for the recorder to say it is recording before reading a stop as an interruption', async () => {
    const { recorder, scheduler, subject } = setup();
    const take = subject.start();

    await live();
    recorder.interruptBySystem();
    play(recorder, scheduler, SPEECH, 2);

    expect(subject.interrupted()).toBe(false);

    subject.stop();
    await take;
  });

  it('is not interrupted before a take, nor after it ends', async () => {
    const { recorder, scheduler, subject } = setup();

    expect(subject.interrupted()).toBe(false);

    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 1);
    recorder.interruptBySystem();
    play(recorder, scheduler, SPEECH, 1);
    subject.stop();
    await take;

    expect(subject.interrupted()).toBe(false);
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

  it('closes the session for a pause, so the system cannot restart the take on its own', async () => {
    const { subject, audioSession } = setup();
    const take = subject.start();

    await live();
    await subject.pause();

    expect(audioSession).toEqual(['enabled', 'disabled']);

    await subject.resume();

    expect(audioSession).toEqual(['enabled', 'disabled', 'enabled']);

    subject.cancel();
    await expect(take).rejects.toThrow(RecordingCancelledError);
  });

  it('leaves the session alone when there is no take to pause or resume', async () => {
    const { recorder, subject, audioSession } = setup();

    await subject.pause();
    await subject.resume();

    expect(audioSession).toEqual([]);
    expect(recorder.pauseCalls).toBe(0);
  });

  it('gives up the take when the session refuses to open', async () => {
    const recorder = new FakeNativeRecorder();
    const scheduler = new ManualScheduler();
    const refused = new Error('Recording not allowed on iOS');
    const screen = new FakeScreen();
    const subject = new ExpoAudioRecorder(
      recorder,
      () => Promise.reject(refused),
      scheduler,
      screen,
      () => undefined,
      OPTIONS,
    );

    await expect(subject.start()).rejects.toThrow(refused);
    expect(recorder.prepareCalls).toBe(0);
    expect(screen.asked).toEqual([]);
  });
});

/*
 * Owner's report, 2026-11-10: the phone dimmed and locked itself while they
 * were talking, and the take stopped hearing them.
 */
describe('ExpoAudioRecorder and the screen', () => {
  it('keeps the screen on while the take is listening, and lets it sleep after stop', async () => {
    const { screen, subject } = setup();
    const take = subject.start();

    await live();
    expect(screen.awake).toBe(true);

    subject.stop();
    await take;
    expect(screen.awake).toBe(false);
  });

  it('lets the screen sleep while a paused take waits, and keeps it on again on resuming', async () => {
    const { screen, subject } = setup();
    const take = subject.start();

    await live();
    await subject.pause();
    expect(screen.awake).toBe(false);

    await subject.resume();
    expect(screen.awake).toBe(true);

    subject.stop();
    await take;
  });

  it('lets the screen sleep when the take is thrown away', async () => {
    const { screen, subject } = setup();
    const take = subject.start();

    await live();
    subject.cancel();
    await expect(take).rejects.toThrow(RecordingCancelledError);
    expect(screen.awake).toBe(false);
  });

  it('lets the screen sleep when the ceiling ends the take', async () => {
    const { recorder, scheduler, screen, subject } = setup();
    const take = subject.start();

    await live();
    play(recorder, scheduler, SPEECH, 10);
    await take;
    expect(screen.awake).toBe(false);
  });
});

/*
 * Every take of one launch is recorded into the same file, and nothing in
 * expo-audio removes it: a take that was not kept stayed in the cache for good.
 */
describe('ExpoAudioRecorder and the take on disk', () => {
  it('removes a cancelled take once the recorder has stopped writing it', async () => {
    const { removed, subject } = setup();
    const take = subject.start();

    await live();
    subject.cancel();

    await expect(take).rejects.toThrow(RecordingCancelledError);
    expect(removed).toEqual([{ uri: 'file:///take.m4a', afterStops: 1 }]);
  });

  it('leaves a finished take where it is until it is let go', async () => {
    const { removed, subject } = setup();
    const pending = subject.start();

    await live();
    subject.stop();

    const take = await pending;

    expect(removed).toEqual([]);

    subject.discard(take.uri);

    expect(removed.map((each) => each.uri)).toEqual([take.uri]);
  });

  it('never removes the file while a take is starting or recording into it', async () => {
    const { removed, subject } = setup();
    const take = subject.start();

    subject.discard('file:///take.m4a');
    await live();
    subject.discard('file:///take.m4a');

    expect(removed).toEqual([]);

    subject.cancel();
    await expect(take).rejects.toThrow(RecordingCancelledError);
  });

  it('leaves a cancelled take to be overwritten when the next take has already begun', async () => {
    const { removed, subject } = setup();
    const first = subject.start();

    await live();
    subject.cancel();

    const second = subject.start();

    await expect(first).rejects.toThrow(RecordingCancelledError);
    await live();
    expect(removed).toEqual([]);

    subject.cancel();
    await expect(second).rejects.toThrow(RecordingCancelledError);
  });
});

describe('what a take leaves running', () => {
  it('stops watching the recorder while a take waits on pause, and watches again when it goes on', async () => {
    const { scheduler, subject } = setup();

    void subject.start();
    await live();
    expect(scheduler.watching).toBe(1);

    await subject.pause();
    expect(scheduler.watching).toBe(0);

    await subject.resume();
    expect(scheduler.watching).toBe(1);
  });

  it('gives the session back to playing once a take is stopped', async () => {
    const { audioSession, subject } = setup();
    const take = subject.start();

    await live();
    subject.stop();
    await take;

    expect(audioSession).toEqual(['enabled', 'disabled']);
  });

  it('gives it back when a take is let go, too', async () => {
    const { audioSession, subject } = setup();
    const take = subject.start().catch(() => undefined);

    await live();
    subject.cancel();
    await take;
    await live();

    expect(audioSession[audioSession.length - 1]).toBe('disabled');
  });
});
