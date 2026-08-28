import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { whenAnalysisLands, type CaptureStage } from '@/presentation/hooks/useCaptureFlow';

const NOW = new Date('2026-08-28T19:00:00.000Z');

function analysis(overrides: Partial<Parameters<typeof MoodEntry.create>[0]> = {}): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: NOW,
    source: 'voice',
    rawTranscript: 'finished three tasks happy but very tired',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud', 'bad.tired'],
    contextTags: ['work'],
    observation: 'The good kind of tired.',
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

const asking: CaptureStage = {
  kind: 'turn',
  spoken: { text: 'Finished three tasks, happy, but very tired.', confidence: Confidence.of(0.9) },
  chosen: ['bad.tired'],
  draft: null,
  holding: false,
};

describe('what happens when the analysis lands', () => {
  it('leaves the question exactly as it was, whatever the analysis found', () => {
    const after = whenAnalysisLands(asking, analysis(), true);

    /*
     * The one defect nobody would notice in use: the card would simply look a
     * little more helpful than it had any right to. Everything the person can
     * see has to be untouched — the transcript, their own words, and whether
     * the card is waiting on anything.
     */
    expect(after.kind).toBe('turn');
    expect(after).toMatchObject({
      spoken: asking.spoken,
      chosen: ['bad.tired'],
      holding: false,
    });
  });

  it('holds the analysis without putting it on screen', () => {
    const after = whenAnalysisLands(asking, analysis(), true);

    // TurnScreen is handed the transcript, the chosen words and `holding`, and
    // nothing else — so carrying the draft here is what makes the comparison
    // instant, not what makes it visible.
    expect(after.kind === 'turn' ? after.draft : null).not.toBeNull();
  });

  it('goes on to the comparison for someone who answered before it arrived', () => {
    const after = whenAnalysisLands({ ...asking, holding: true }, analysis(), true);

    expect(after.kind).toBe('comparing');
  });

  it('never sets a difficult entry beside the answer', () => {
    const after = whenAnalysisLands(
      { ...asking, holding: true },
      analysis({ safetyFlag: 'distress' }),
      true,
    );

    // §M6: setting somebody's answer against Vidlun's and naming the gap is a
    // thing to do with an ordinary day, not with a hard one.
    expect(after.kind).toBe('reflecting');
  });

  it('takes the question out of the path entirely when it is switched off', () => {
    const after = whenAnalysisLands({ kind: 'processing' }, analysis(), false);

    expect(after.kind).toBe('reflecting');
  });

  it('drops an analysis that belongs to a card nobody is on any more', () => {
    const after = whenAnalysisLands({ kind: 'idle' }, analysis(), true);

    expect(after).toEqual({ kind: 'idle' });
  });
});
