import type { IFeedbackSender } from '@/domain/ports/IFeedbackSender';
import { FeedbackOutbox } from '@/infrastructure/feedback/FeedbackOutbox';

import { InMemoryKeyValueStore } from './fakes';

const KEY = 'vidlun.feedbackOutbox';

/** A proxy the test controls: refuses, or holds a note until released. */
class ScriptedSender implements IFeedbackSender {
  readonly delivered: string[] = [];
  refusing = false;
  holding = false;
  private release: (() => void)[] = [];

  async send(text: string): Promise<void> {
    if (this.refusing) {
      throw new Error('502');
    }

    if (this.holding) {
      await new Promise<void>((resolve) => this.release.push(resolve));
    }

    this.delivered.push(text);
  }

  releaseAll(): void {
    const waiting = this.release;

    this.release = [];
    waiting.forEach((resolve) => resolve());
  }
}

function setup() {
  const store = new InMemoryKeyValueStore();
  const sender = new ScriptedSender();
  let serial = 0;
  const outbox = new FeedbackOutbox(
    store,
    sender,
    { next: () => `note-${String(++serial)}` },
    { now: () => new Date('2026-09-04T12:00:00.000Z') },
  );

  return { store, sender, outbox };
}

/** Lets the outbox's own awaits run to completion. */
async function settle(): Promise<void> {
  for (let round = 0; round < 8; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function pendingTexts(store: InMemoryKeyValueStore): Promise<string[]> {
  const raw = await store.getItem(KEY);

  return raw === null ? [] : (JSON.parse(raw) as { text: string }[]).map((note) => note.text);
}

describe('a note on its way to support', () => {
  it('is mailed as soon as it is given', async () => {
    const { store, sender, outbox } = setup();

    await outbox.send('the button is under the keyboard');
    await settle();

    expect(sender.delivered).toEqual(['the button is under the keyboard']);
    expect(await pendingTexts(store)).toEqual([]);
  });

  it('is kept before it is mailed, so the sheet can close at once', async () => {
    const { store, sender, outbox } = setup();
    sender.holding = true;

    await outbox.send('still typing');

    expect(await pendingTexts(store)).toEqual(['still typing']);
    expect(sender.delivered).toEqual([]);

    sender.releaseAll();
    await settle();

    expect(sender.delivered).toEqual(['still typing']);
    expect(await pendingTexts(store)).toEqual([]);
  });

  it('waits out a refusal and goes at the next flush', async () => {
    const { store, sender, outbox } = setup();
    sender.refusing = true;

    await outbox.send('offline on the train');
    await settle();

    expect(sender.delivered).toEqual([]);
    expect(await pendingTexts(store)).toEqual(['offline on the train']);

    sender.refusing = false;
    await outbox.flush();

    expect(sender.delivered).toEqual(['offline on the train']);
    expect(await pendingTexts(store)).toEqual([]);
  });

  it('is still waiting for a new instance, as after the app was ended', async () => {
    const { store, sender, outbox } = setup();
    sender.refusing = true;
    await outbox.send('written last night');
    await settle();

    const later = new FeedbackOutbox(
      store,
      sender,
      { next: () => 'note-later' },
      { now: () => new Date('2026-09-05T08:00:00.000Z') },
    );
    sender.refusing = false;
    await later.flush();

    expect(sender.delivered).toEqual(['written last night']);
  });

  it('goes oldest first', async () => {
    const { sender, outbox } = setup();
    sender.refusing = true;
    await outbox.send('first');
    await outbox.send('second');
    await settle();

    sender.refusing = false;
    await outbox.flush();

    expect(sender.delivered).toEqual(['first', 'second']);
  });

  it('is not lost when written while another note is on its way', async () => {
    const { store, sender, outbox } = setup();
    sender.holding = true;
    await outbox.send('first');
    await settle();

    await outbox.send('second');
    sender.holding = false;
    sender.releaseAll();
    await settle();

    expect(sender.delivered).toEqual(['first', 'second']);
    expect(await pendingTexts(store)).toEqual([]);
  });

  it('is never mailed twice by two flushes at once', async () => {
    const { sender, outbox } = setup();
    sender.holding = true;
    await outbox.send('once');
    await settle();

    const flushes = Promise.all([outbox.flush(), outbox.flush()]);
    sender.holding = false;
    sender.releaseAll();
    await flushes;
    await settle();

    expect(sender.delivered).toEqual(['once']);
  });

  it('forgets a list it cannot read rather than failing forever', async () => {
    const { store, sender, outbox } = setup();
    await store.setItem(KEY, 'not json');

    await outbox.flush();
    await outbox.send('fresh');
    await settle();

    expect(sender.delivered).toEqual(['fresh']);
  });
});
