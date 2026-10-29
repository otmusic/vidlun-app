import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { whenMoodSet, type CaptureStage, type TurnStage } from '@/presentation/hooks/useCaptureFlow';

const NOW = new Date('2026-10-29T19:00:00.000Z');
const SPOKEN = { text: 'Finished three tasks, happy, but very tired.', confidence: Confidence.of(0.9) };

const reading = MoodEntry.create({
  id: 'entry-1',
  createdAt: NOW,
  source: 'voice',
  rawTranscript: SPOKEN.text,
  cleanTranscript: SPOKEN.text,
  mood: MoodScore.of(4),
  emotionIds: ['happy.proud', 'bad.tired'],
  contextTags: ['work'],
  observation: null,
  confidence: SPOKEN.confidence,
});

const card: TurnStage = {
  kind: 'turn',
  spoken: SPOKEN,
  chosen: [],
  draft: reading,
  nearby: [],
  holding: false,
  unheard: false,
  together: false,
  mood: null,
  droppedTopics: [],
};

describe('setting the mood', () => {
  it('sets it on the question card', () => {
    expect(whenMoodSet(card, 2)).toMatchObject({ kind: 'turn', mood: 2 });
  });

  /*
   * From the phone (2026-10-29): after "choose together" the scale was not on
   * the screen at all, so the mood the reading guessed was the one saved.
   */
  it('sets it on the entry being chosen together, and on the card behind it', () => {
    const choosing: CaptureStage = { kind: 'comparing', proposed: reading, draft: reading, card };

    const after = whenMoodSet(choosing, 2);

    expect(after.kind === 'comparing' ? after.draft.mood?.value : null).toBe(2);
    expect(after.kind === 'comparing' ? after.card.mood : null).toBe(2);
    // What Vidlun read stays as it read it, for the revision log.
    expect(after.kind === 'comparing' ? after.proposed.mood?.value : null).toBe(4);
  });

  it('leaves every other screen as it was', () => {
    const idle: CaptureStage = { kind: 'idle' };

    expect(whenMoodSet(idle, 2)).toBe(idle);
  });
});
