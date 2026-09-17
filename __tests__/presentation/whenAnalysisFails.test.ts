import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { whenAnalysisFails, type CaptureStage } from '@/presentation/hooks/useCaptureFlow';

const NOW = new Date('2026-09-17T19:00:00.000Z');
const SPOKEN = { text: 'Finished three tasks, happy, but very tired.', confidence: Confidence.of(0.9) };

/** The draft `CreateUnheardEntry` makes: the words alone, nothing of Vidlun's. */
const wordsAlone = MoodEntry.create({
  id: 'entry-1',
  createdAt: NOW,
  source: 'voice',
  rawTranscript: SPOKEN.text,
  cleanTranscript: SPOKEN.text,
  mood: null,
  emotionIds: [],
  proposedEmotionIds: [],
  contextTags: [],
  observation: null,
  confidence: SPOKEN.confidence,
  safetyFlag: 'none',
});

const asking: CaptureStage = {
  kind: 'turn',
  spoken: SPOKEN,
  chosen: ['bad.tired'],
  draft: null,
  holding: false,
  unheard: false,
};

describe('what happens when the analysis fails', () => {
  it('goes on with the words alone on the card it was started for', () => {
    const after = whenAnalysisFails(asking, wordsAlone, SPOKEN);

    // The person's own answer and whether they are waiting are untouched; the
    // card now knows the answer they give is the whole entry.
    expect(after).toEqual({ ...asking, draft: wordsAlone, unheard: true });
  });

  it('keeps an answer already given while it was failing', () => {
    const after = whenAnalysisFails({ ...asking, holding: true }, wordsAlone, SPOKEN);

    // `holding` with `unheard` and a draft is what saves the entry at once.
    expect(after).toMatchObject({ kind: 'turn', holding: true, unheard: true, draft: wordsAlone });
  });

  it('leaves a card with other words alone', () => {
    // The person corrected the transcript while the first reading was still
    // out; its failure belongs to a sentence nobody is on any more.
    const corrected: CaptureStage = {
      ...asking,
      spoken: { text: 'Finished three tasks, happy but very tired.', confidence: Confidence.of(1) },
    };

    expect(whenAnalysisFails(corrected, wordsAlone, SPOKEN)).toBe(corrected);
  });

  it('leaves any other screen alone', () => {
    const processing: CaptureStage = { kind: 'processing' };

    expect(whenAnalysisFails(processing, wordsAlone, SPOKEN)).toBe(processing);
  });
});
