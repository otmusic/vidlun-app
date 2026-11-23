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
  addedTopics: [],
  namedAlone: null,
};

describe('setting the mood', () => {
  it('sets it on the question card', () => {
    expect(whenMoodSet(card, 2)).toMatchObject({ kind: 'turn', mood: 2 });
  });

  /*
   * Owner's word, 2026-11-12: choosing together has no scale any more. Its
   * "save" goes back to the card, and the card's scale is the one saved.
   */
  it('leaves choosing together alone, since the mood is set on the card', () => {
    const choosing: CaptureStage = { kind: 'comparing', proposed: reading, draft: reading, card };

    expect(whenMoodSet(choosing, 2)).toBe(choosing);
  });

  it('leaves every other screen as it was', () => {
    const idle: CaptureStage = { kind: 'idle' };

    expect(whenMoodSet(idle, 2)).toBe(idle);
  });
});
