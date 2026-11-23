import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  whenAnswered,
  whenChosenTogether,
  type CaptureStage,
  type TurnStage,
} from '@/presentation/hooks/useCaptureFlow';

const NOW = new Date('2026-11-12T19:00:00.000Z');
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

/** The question card with the reading in, the person having named one word. */
const card: TurnStage = {
  kind: 'turn',
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

/** "Choose together", opened from that card. */
function choosing(): Extract<CaptureStage, { kind: 'comparing' }> {
  const stage = whenAnswered(card, true);

  if (stage.kind !== 'comparing') {
    throw new Error(`expected the choosing-together stage, got ${stage.kind}`);
  }

  return stage;
}

/** Choosing together with these words left on the entry, then "save". */
function backWith(kept: readonly string[]): TurnStage {
  const stage = choosing();
  const after = whenChosenTogether({ ...stage, draft: stage.draft.withEmotionIds(kept) });

  if (after.kind !== 'turn') {
    throw new Error(`expected the card, got ${after.kind}`);
  }

  return after;
}

describe('saving what was chosen together', () => {
  /*
   * Owner's word, 2026-11-12: "save" on choosing together goes back to the
   * entry's card with the words on it, rather than writing the entry there.
   */
  it('goes back to the card with the words chosen together on it', () => {
    const after = backWith(['happy.content', 'bad.tired']);

    expect(after).toMatchObject({
      kind: 'turn',
      chosen: ['happy.content', 'bad.tired'],
      // The card as it was otherwise: its mood, its topics, the reading in hand.
      mood: 2,
      droppedTopics: ['sleep'],
      draft: reading,
      holding: false,
      together: false,
    });
  });

  it('remembers what was named before Vidlun’s words were seen', () => {
    expect(backWith(['bad.tired']).namedAlone).toEqual(['happy.content']);
  });

  it('writes the entry from the card, keeping the unaided answer apart', () => {
    const saving = whenAnswered(backWith(['happy.content', 'bad.tired']), false);

    expect(saving.kind).toBe('saving');
    if (saving.kind !== 'saving') {
      return;
    }
    expect(saving.draft.emotionIds).toEqual(['happy.content', 'bad.tired']);
    // The granularity metric reads this: Vidlun's words must not become the person's.
    expect(saving.draft.selfEmotionIds).toEqual(['happy.content']);
    expect(saving.draft.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(saving.draft.mood?.value).toBe(2);
    expect(saving.draft.contextTags).toEqual(['work']);
  });

  it('logs a word of Vidlun’s taken off while choosing together as a disagreement', () => {
    const saving = whenAnswered(backWith(['happy.content', 'bad.tired']), false);

    expect(saving.kind === 'saving' ? saving.declined : null).toBe(true);
  });

  it('logs no disagreement when every word of Vidlun’s was kept', () => {
    const saving = whenAnswered(backWith(['happy.content', 'happy.proud', 'bad.tired']), false);

    expect(saving.kind === 'saving' ? saving.declined : null).toBe(false);
  });

  it('logs no disagreement for an answer given without seeing Vidlun’s words', () => {
    const saving = whenAnswered(card, false);

    expect(saving.kind === 'saving' ? saving.declined : null).toBe(false);
  });

  it('takes no words, chosen together, as a whole answer', () => {
    const saving = whenAnswered(backWith([]), false);

    // §6: zero emotions is a complete entry, and here it was a deliberate one.
    expect(saving.kind).toBe('saving');
    expect(saving.kind === 'saving' ? saving.draft.emotionIds : null).toEqual([]);
  });

  it('opens choosing together again on the words left last time, not all of Vidlun’s', () => {
    const again = whenAnswered(backWith(['bad.tired']), true);

    expect(again.kind === 'comparing' ? again.draft.emotionIds : null).toEqual(['bad.tired']);
    expect(again.kind === 'comparing' ? again.draft.selfEmotionIds : null).toEqual([
      'happy.content',
    ]);
  });

  it('leaves every other screen as it was', () => {
    const idle: CaptureStage = { kind: 'idle' };

    expect(whenChosenTogether(idle)).toBe(idle);
  });
});
