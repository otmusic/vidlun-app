import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  declinedVidlunsWords,
  whenAnalysisLands,
  type CaptureStage,
} from '@/presentation/hooks/useCaptureFlow';

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
  unheard: false,
  together: false,
  mood: null,
};

describe('what happens when the analysis lands', () => {
  it('leaves the question exactly as it was, whatever the analysis found', () => {
    const after = whenAnalysisLands(asking, analysis());

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
      unheard: false,
    });
  });

  it('holds the analysis without putting it on screen', () => {
    const after = whenAnalysisLands(asking, analysis());

    // TurnScreen is handed the transcript, the chosen words and `holding`, and
    // nothing else — so carrying the draft here is what makes the comparison
    // instant, not what makes it visible.
    expect(after.kind === 'turn' ? after.draft : null).not.toBeNull();
  });

  it("saves a named feeling at once, with no card and no list of Vidlun's words", () => {
    const after = whenAnalysisLands({ ...asking, holding: true }, analysis());

    // Owner's word, 2026-09-30: someone who named the feeling goes on to
    // "saved" — the card after the answer was one screen too many. What
    // Vidlun heard is still kept, as the proposal.
    expect(after.kind).toBe('saving');
    expect(after.kind === 'saving' ? after.draft.emotionIds : null).toEqual(['bad.tired']);
    expect(after.kind === 'saving' ? after.draft.selfEmotionIds : null).toEqual(['bad.tired']);
    expect(after.kind === 'saving' ? after.draft.proposedEmotionIds : null).toEqual([
      'happy.proud',
      'bad.tired',
    ]);
  });

  it("keeps the mood set on the card's scale, over Vidlun's reading", () => {
    const after = whenAnalysisLands({ ...asking, holding: true, mood: 2 }, analysis());

    // Owner's word, 2026-10-01: the mood is set on the card itself.
    expect(after.kind === 'saving' ? after.draft.mood?.value : null).toBe(2);
    expect(after.kind === 'saving' ? after.proposed.mood?.value : null).toBe(4);
  });

  it("keeps Vidlun's mood when the scale was left alone", () => {
    const after = whenAnalysisLands({ ...asking, holding: true }, analysis());

    expect(after.kind === 'saving' ? after.draft.mood?.value : null).toBe(4);
  });

  it('carries the mood set on the card into choosing together, and back', () => {
    const after = whenAnalysisLands(
      { ...asking, holding: true, together: true, mood: 5 },
      analysis(),
    );

    expect(after.kind === 'comparing' ? after.draft.mood?.value : null).toBe(5);
    expect(after.kind === 'comparing' ? after.card.mood : null).toBe(5);
  });

  it("shows Vidlun's answer to someone who went on without naming anything", () => {
    const after = whenAnalysisLands({ ...asking, chosen: [], holding: true }, analysis());

    expect(after.kind).toBe('comparing');
  });

  it("offers Vidlun's words already chosen, after the person's own, when choosing together", () => {
    const after = whenAnalysisLands({ ...asking, holding: true, together: true }, analysis());

    // Owner's word, 2026-10-01: one list, everything in it chosen to start
    // with. Their word stays the unaided answer.
    expect(after.kind).toBe('comparing');
    expect(after.kind === 'comparing' ? after.draft.emotionIds : null).toEqual([
      'bad.tired',
      'happy.proud',
    ]);
    expect(after.kind === 'comparing' ? after.draft.selfEmotionIds : null).toEqual(['bad.tired']);
  });

  it('starts with no more than the four words an entry can hold', () => {
    const after = whenAnalysisLands(
      { ...asking, chosen: ['angry', 'sad', 'fearful'], holding: true, together: true },
      analysis(),
    );

    expect(after.kind === 'comparing' ? after.draft.emotionIds : null).toEqual([
      'angry',
      'sad',
      'fearful',
      'happy.proud',
    ]);
  });

  it('remembers the card it came from, for the way back', () => {
    const after = whenAnalysisLands({ ...asking, holding: true, together: true }, analysis());
    const card = after.kind === 'comparing' ? after.card : null;

    // Back is the card as it was — the words, what was named, the reading in
    // hand — and no longer on its way anywhere.
    expect(card).toMatchObject({
      kind: 'turn',
      spoken: asking.spoken,
      chosen: ['bad.tired'],
      holding: false,
      together: false,
    });
    expect(card?.draft?.emotionIds).toEqual(['happy.proud', 'bad.tired']);
  });

  it('brings a difficult entry to the same words when choosing together', () => {
    const after = whenAnalysisLands(
      { ...asking, chosen: [], holding: true, together: true },
      analysis({ safetyFlag: 'distress' }),
    );

    // The answer is no longer set beside Vidlun's, so there is no comparison
    // left to spare a hard entry; its flag still brings grounding after.
    expect(after.kind).toBe('comparing');
    expect(after.kind === 'comparing' ? after.draft.safetyFlag : null).toBe('distress');
  });

  it('drops an analysis that belongs to a card nobody is on any more', () => {
    const after = whenAnalysisLands({ kind: 'idle' }, analysis());

    expect(after).toEqual({ kind: 'idle' });
  });

  it("saves the person's own words on a hard entry too, keeping what Vidlun heard apart", () => {
    const after = whenAnalysisLands(
      { ...asking, holding: true },
      analysis({ safetyFlag: 'distress', emotionIds: ['angry', 'fearful.scared'] }),
    );

    // Their answer is the entry; the flag travels with it, so the saved
    // screen still offers grounding.
    expect(after.kind).toBe('saving');
    expect(after.kind === 'saving' ? after.draft.emotionIds : null).toEqual(['bad.tired']);
    expect(after.kind === 'saving' ? after.draft.safetyFlag : null).toBe('distress');
  });

  it('drops an analysis of wording the person has since corrected', () => {
    const after = whenAnalysisLands(asking, analysis(), 'what the recorder misheard');

    // The corrected words' own analysis is on its way; emotions read off the
    // mishearing must never reach the card, held or shown.
    expect(after).toEqual(asking);
  });

  it('never lets a stale analysis answer for someone already waiting', () => {
    const after = whenAnalysisLands(
      { ...asking, holding: true },
      analysis(),
      'what the recorder misheard',
    );

    expect(after.kind).toBe('turn');
  });

  it('lands an analysis that matches the wording it was started for', () => {
    const after = whenAnalysisLands(asking, analysis(), asking.spoken.text);

    expect(after.kind === 'turn' ? after.draft : null).not.toBeNull();
  });
});

describe("what counts as declining Vidlun's words", () => {
  const heard = analysis({ emotionIds: ['happy.proud', 'bad.tired'] });

  function chosenTogether(selfEmotionIds: readonly string[], emotionIds: readonly string[]) {
    return MoodEntry.create({ ...heard.toProps(), selfEmotionIds, emotionIds });
  }

  it('is nothing while every word Vidlun started with is still in', () => {
    expect(declinedVidlunsWords(heard, chosenTogether([], ['happy.proud', 'bad.tired']))).toBe(
      false,
    );
  });

  it('is taking off one of the words that came already chosen', () => {
    expect(declinedVidlunsWords(heard, chosenTogether([], ['bad.tired']))).toBe(true);
  });

  it('is not a word the four-word ceiling kept out to begin with', () => {
    const draft = chosenTogether(
      ['angry', 'sad', 'fearful'],
      ['angry', 'sad', 'fearful', 'happy.proud'],
    );

    // bad.tired never made it into the list as chosen; nobody took it off.
    expect(declinedVidlunsWords(heard, draft)).toBe(false);
  });

  it('is nothing when Vidlun heard nothing to decline', () => {
    const silent = analysis({ emotionIds: [] });
    const draft = MoodEntry.create({ ...silent.toProps(), emotionIds: ['own:Calm'] });

    expect(declinedVidlunsWords(silent, draft)).toBe(false);
  });
});

