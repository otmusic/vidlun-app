import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  whenAnswered,
  whenChosenTogether,
  whenTogetherOpened,
  type CaptureStage,
  type TurnStage,
} from '@/presentation/hooks/useCaptureFlow';

const NOW = new Date('2026-11-24T19:00:00.000Z');
const SPOKEN = { text: 'Finished three tasks, happy, but very tired.', confidence: Confidence.of(0.9) };

const reading = MoodEntry.create({
  id: 'entry-1',
  createdAt: NOW,
  source: 'voice',
  rawTranscript: SPOKEN.text,
  cleanTranscript: SPOKEN.text,
  mood: MoodScore.of(4),
  emotionIds: ['happy.proud', 'bad.tired'],
  contextTags: ['work', 'sleep'],
  observation: 'The good kind of tired.',
  confidence: SPOKEN.confidence,
});

/** The feelings step with the reading in, the person having named one word. */
const card: TurnStage = {
  kind: 'turn',
  step: 'feelings',
  spoken: SPOKEN,
  chosen: ['happy.content'],
  draft: reading,
  nearby: [],
  holding: false,
  unheard: false,
  together: false,
  mood: 2,
  droppedTopics: ['sleep'],
  addedTopics: [],
  namedAlone: null,
};

function turn(stage: CaptureStage): TurnStage {
  if (stage.kind !== 'turn') {
    throw new Error(`expected the card, got ${stage.kind}`);
  }

  return stage;
}

/** The sheet opened on that card, then "choose" with these of Vidlun's words left chosen. */
function chose(picked: readonly string[]): TurnStage {
  return turn(whenChosenTogether(whenTogetherOpened(card), picked));
}

/** "Save" on the mood step, which writes the entry. */
function saved(stage: TurnStage): Extract<CaptureStage, { kind: 'saving' }> {
  const after = whenAnswered({ ...stage, step: 'mood' });

  if (after.kind !== 'saving') {
    throw new Error(`expected the entry to be written, got ${after.kind}`);
  }

  return after;
}

describe('choosing together in a sheet', () => {
  /*
   * Owner's word, 2026-11-24: choosing together is a sheet over the
   * feelings step, not a page. Opening it puts Vidlun's words in sight, so
   * what was named until then is the unaided answer from that moment.
   */
  it('keeps what was named before the sheet opened as the unaided answer', () => {
    const opened = turn(whenTogetherOpened(card));

    expect(opened.namedAlone).toEqual(['happy.content']);
    // Opening it changes nothing on the card itself.
    expect(opened.chosen).toEqual(['happy.content']);
    expect(opened.step).toBe('feelings');
  });

  it('keeps the first unaided answer however often the sheet opens', () => {
    const again = whenTogetherOpened({ ...turn(whenTogetherOpened(card)), chosen: ['happy.content', 'sad'] });

    expect(turn(again).namedAlone).toEqual(['happy.content']);
  });

  it('puts the words chosen in the sheet on the card, after the person’s own', () => {
    const after = chose(['happy.proud', 'bad.tired']);

    expect(after).toMatchObject({
      kind: 'turn',
      step: 'feelings',
      chosen: ['happy.content', 'happy.proud', 'bad.tired'],
      namedAlone: ['happy.content'],
      // Its way is gone from the card once the words are on it.
      together: true,
      // The card as it was otherwise: its mood, its topics, the reading in hand.
      mood: 2,
      droppedTopics: ['sleep'],
      draft: reading,
    });
  });

  it('takes off nothing already on the card', () => {
    expect(chose([]).chosen).toEqual(['happy.content']);
  });

  it('keeps no more than the six words an entry can hold', () => {
    const full = { ...card, chosen: ['angry', 'sad', 'fearful', 'surprised', 'disgusted'] };
    const after = turn(whenChosenTogether(whenTogetherOpened(full), ['happy.proud', 'bad.tired']));

    expect(after.chosen).toEqual(['angry', 'sad', 'fearful', 'surprised', 'disgusted', 'happy.proud']);
  });

  it('writes the entry from the card, keeping the unaided answer apart', () => {
    const saving = saved(chose(['bad.tired']));

    expect(saving.draft.emotionIds).toEqual(['happy.content', 'bad.tired']);
    // The granularity metric reads this: Vidlun's words must not become the person's.
    expect(saving.draft.selfEmotionIds).toEqual(['happy.content']);
    expect(saving.draft.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(saving.draft.mood?.value).toBe(2);
    expect(saving.draft.contextTags).toEqual(['work']);
  });

  it('logs a word of Vidlun’s left out of the sheet as a disagreement', () => {
    expect(saved(chose(['bad.tired'])).declined).toBe(true);
  });

  it('logs no disagreement when every word of Vidlun’s was taken', () => {
    expect(saved(chose(['happy.proud', 'bad.tired'])).declined).toBe(false);
  });

  it('logs no disagreement for an answer given without seeing Vidlun’s words', () => {
    expect(saved(card).declined).toBe(false);
  });

  it('takes the sheet closed with nothing chosen as an answer given with Vidlun’s words in sight', () => {
    const saving = saved({ ...turn(whenTogetherOpened({ ...card, chosen: [] })) });

    // §6: zero emotions is a complete entry, and here it was a deliberate one.
    expect(saving.draft.emotionIds).toEqual([]);
    expect(saving.declined).toBe(true);
  });

  /*
   * Owner's word, 2026-11-24: with no clear emotion heard there is no way to
   * choose together, and the card goes on without a word.
   */
  it('saves no words when Vidlun heard none and the person named none', () => {
    const silent = MoodEntry.create({ ...reading.toProps(), emotionIds: [] });
    const saving = saved({ ...card, chosen: [], draft: silent });

    expect(saving.draft.emotionIds).toEqual([]);
    expect(saving.draft.selfEmotionIds).toEqual([]);
    expect(saving.declined).toBe(false);
  });

  it('waits for the reading before the sheet can open', () => {
    const asking: TurnStage = { ...card, draft: null };

    expect(whenTogetherOpened(asking)).toBe(asking);
    expect(whenChosenTogether(asking, ['bad.tired'])).toBe(asking);
  });

  it('leaves every other screen as it was', () => {
    const idle: CaptureStage = { kind: 'idle' };

    expect(whenTogetherOpened(idle)).toBe(idle);
    expect(whenChosenTogether(idle, ['bad.tired'])).toBe(idle);
  });
});
