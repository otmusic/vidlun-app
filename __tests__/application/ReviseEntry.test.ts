import { ReviseEntry } from '@/application/use-cases/ReviseEntry';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { TooManyEmotionsError } from '@/domain/errors/MoodEntryErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

const useCase = new ReviseEntry(createEmotionVocabulary());

function draft(): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: new Date('2026-07-31T20:15:00.000Z'),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud', 'bad.tired'],
    confidence: Confidence.of(0.3),
  });
}

describe('ReviseEntry', () => {
  it('marks the entry as corrected by the user rather than proposed by Vidlun', () => {
    const revised = useCase.execute(draft(), { mood: MoodScore.of(2) });

    expect(revised.wasRevisedByUser).toBe(true);
    expect(revised.mood?.value).toBe(2);
  });

  it('lets the user pick a sensitive state Vidlun is not allowed to offer', () => {
    const revised = useCase.execute(draft(), { emotionIds: ['fearful.weak.worthless'] });

    expect(revised.emotionIds).toEqual(['fearful.weak.worthless']);
  });

  it('keeps a specific choice specific even on a badly heard entry', () => {
    const revised = useCase.execute(draft(), { emotionIds: ['sad.lonely.abandoned'] });

    expect(revised.needsUserReview).toBe(true);
    expect(revised.emotionIds).toEqual(['sad.lonely.abandoned']);
  });

  it('drops an emotion that is not in the wheel', () => {
    const revised = useCase.execute(draft(), { emotionIds: ['bad.tired', 'invented.state'] });

    expect(revised.emotionIds).toEqual(['bad.tired']);
  });

  it('lets the user clear every emotion off the card', () => {
    const revised = useCase.execute(draft(), { emotionIds: [] });

    expect(revised.emotionIds).toEqual([]);
    expect(revised.wasRevisedByUser).toBe(true);
  });

  it('corrects the transcript and the tags without touching the emotions', () => {
    const revised = useCase.execute(draft(), {
      cleanTranscript: 'Finished three tasks.',
      contextTags: ['work', 'late'],
    });

    expect(revised.cleanTranscript).toBe('Finished three tasks.');
    expect(revised.contextTags).toEqual(['work', 'late']);
    expect(revised.emotionIds).toEqual(['happy.proud', 'bad.tired']);
  });

  it('still refuses a fifth emotion', () => {
    expect(() =>
      useCase.execute(draft(), {
        emotionIds: ['happy', 'sad', 'bad', 'angry', 'fearful'],
      }),
    ).toThrow(TooManyEmotionsError);
  });

  it('leaves the draft it was given untouched', () => {
    const original = draft();

    useCase.execute(original, { emotionIds: [] });

    expect(original.emotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(original.wasRevisedByUser).toBe(false);
  });
});
