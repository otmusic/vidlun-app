import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  whenAnswered,
  whenChosenTogether,
  whenStepped,
  whenSteppedBack,
  type CaptureStage,
  type TurnStage,
} from '@/presentation/hooks/useCaptureFlow';

const SPOKEN = { text: 'Long day, calmer by the evening.', confidence: Confidence.of(0.9) };

const reading = MoodEntry.create({
  id: 'entry-1',
  createdAt: new Date('2026-11-23T19:14:00.000Z'),
  source: 'voice',
  rawTranscript: SPOKEN.text,
  cleanTranscript: SPOKEN.text,
  mood: MoodScore.of(4),
  emotionIds: ['happy.peaceful'],
  contextTags: ['work'],
  confidence: SPOKEN.confidence,
});

const card: TurnStage = {
  kind: 'turn',
  step: 'words',
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

function stepOf(stage: CaptureStage): string {
  return stage.kind === 'turn' ? stage.step : stage.kind;
}

describe('the steps of the card', () => {
  it('goes from the words to the feelings to the mood, keeping everything on the card', () => {
    const feelings = whenStepped({ ...card, chosen: ['bad.tired'], addedTopics: ['tea'] }, 'feelings');
    const mood = whenStepped(feelings, 'mood');

    expect(stepOf(feelings)).toBe('feelings');
    expect(stepOf(mood)).toBe('mood');
    expect(mood).toMatchObject({ chosen: ['bad.tired'], addedTopics: ['tea'], draft: reading });
  });

  it('goes back one step at a time, and no further than the words', () => {
    const fromMood = whenSteppedBack({ ...card, step: 'mood' });

    expect(stepOf(fromMood)).toBe('feelings');
    expect(stepOf(whenSteppedBack(fromMood))).toBe('words');
    expect(whenSteppedBack(card)).toBe(card);
  });

  it('keeps what was chosen when going back', () => {
    expect(whenSteppedBack({ ...card, step: 'mood', chosen: ['bad.tired'], mood: 2 })).toMatchObject({
      chosen: ['bad.tired'],
      mood: 2,
    });
  });

  it('leaves anything that is no longer the card alone', () => {
    const home: CaptureStage = { kind: 'idle' };

    expect(whenStepped(home, 'mood')).toBe(home);
    expect(whenSteppedBack(home)).toBe(home);
  });

  it('saves from the mood once a word was named', () => {
    const saving = whenAnswered({ ...card, step: 'mood', chosen: ['bad.tired'], mood: 3 });

    expect(saving.kind).toBe('saving');
    expect(saving.kind === 'saving' ? saving.draft.mood?.value : null).toBe(3);
  });

  it('stays on the feelings after choosing together, with the words chosen there', () => {
    const after = whenChosenTogether({ ...card, step: 'feelings', chosen: ['bad.tired'] }, ['happy.peaceful']);

    // Owner's word, 2026-11-24: a sheet over the step, not a page to come back from.
    expect(stepOf(after)).toBe('feelings');
    expect(after).toMatchObject({ chosen: ['bad.tired', 'happy.peaceful'], namedAlone: ['bad.tired'] });
  });
});
