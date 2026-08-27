import { CreateVoiceEntry } from '@/application/use-cases/CreateVoiceEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { NothingWasSaidError } from '@/domain/errors/MoodEntryErrors';
import type { ReflectionProposal } from '@/domain/ports/IReflectionAnalyzer';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import {
  FixedClock,
  proposal,
  RECORDING,
  SequentialIdGenerator,
  StubReflectionAnalyzer,
  StubTranscriptionService,
} from './fakes';

const NOW = new Date('2026-07-31T20:15:00.000Z');
const vocabulary: EmotionVocabulary = createEmotionVocabulary();

interface Heard {
  readonly text: string;
  readonly confidence: number;
}

function capture(heard: Heard, proposed: ReflectionProposal) {
  const analyzer = new StubReflectionAnalyzer(proposed);
  const useCase = new CreateVoiceEntry(
    new StubTranscriptionService(heard),
    analyzer,
    vocabulary,
    new FixedClock(NOW),
    new SequentialIdGenerator(),
  );

  return { analyzer, run: () => useCase.execute(RECORDING) };
}

const CLEARLY_HEARD = { text: 'raw words', confidence: 0.95 };

describe('regression suite from real recordings', () => {
  it('keeps both poles of a mixed state instead of averaging them', async () => {
    const { run } = capture(CLEARLY_HEARD, {
      ...proposal({
        cleanTranscript: 'Finished three tasks, happy, but very tired.',
        mood: 4,
        emotionIds: ['happy.proud.successful', 'bad.tired.drained'],
      }),
    });

    const entry = await run();

    expect(entry.emotionIds).toEqual(['happy.proud.successful', 'bad.tired.drained']);
    expect(entry.mood.value).toBe(4);

    const branches = entry.emotionIds.map((id) => vocabulary.find(id)?.rootId);
    expect(new Set(branches).size).toBe(2);
  });

  it('invents no emotion for a mundane entry', async () => {
    const { run } = capture(
      { text: 'Cooked dinner.', confidence: 0.95 },
      proposal({ cleanTranscript: 'Cooked dinner.', mood: 3, emotionIds: [] }),
    );

    const entry = await run();

    expect(entry.emotionIds).toEqual([]);
    expect(entry.hasEmotions).toBe(false);
  });

  it('broadens emotions and asks for a look when the transcript was barely heard', async () => {
    const { run } = capture(
      { text: 'something something tired', confidence: 0.3 },
      proposal({ emotionIds: ['happy.proud.successful', 'bad.tired.drained'] }),
    );

    const entry = await run();

    expect(entry.emotionIds).toEqual(['happy', 'bad']);
    expect(entry.needsUserReview).toBe(true);
  });

  it('drops an emotion the model invented without failing the entry', async () => {
    const { run } = capture(
      CLEARLY_HEARD,
      proposal({ emotionIds: ['happy.proud', 'happy.smug', 'not_a_real_branch'] }),
    );

    const entry = await run();

    expect(entry.emotionIds).toEqual(['happy.proud']);
  });
});

describe('CreateVoiceEntry', () => {
  it('never offers a sensitive state on its own', async () => {
    const { run } = capture(
      CLEARLY_HEARD,
      proposal({ emotionIds: ['fearful.weak.worthless', 'bad.tired'] }),
    );

    expect((await run()).emotionIds).toEqual(['bad.tired']);
  });

  it('pulls an out-of-range mood back onto the scale', async () => {
    const { run } = capture(CLEARLY_HEARD, proposal({ mood: 9 }));

    expect((await run()).mood.value).toBe(5);
  });

  it('caps the card at four emotions', async () => {
    const { run } = capture(
      CLEARLY_HEARD,
      proposal({
        emotionIds: ['happy', 'sad', 'bad', 'angry', 'fearful', 'disgusted'],
      }),
    );

    expect((await run()).emotionIds).toEqual(['happy', 'sad', 'bad', 'angry']);
  });

  it('hands back a draft with nothing said yet, whatever the entry is', async () => {
    const { run } = capture(CLEARLY_HEARD, proposal({ safetyFlag: 'crisis' }));

    const entry = await run();

    expect(entry.safetyFlag).toBe('crisis');
    // Vidlun's sentence is written by WriteObservation once the card is showing.
    expect(entry.observation).toBeNull();
  });

  it('analyses what was heard, not the raw audio', async () => {
    const { analyzer, run } = capture({ text: '  spoken words  ', confidence: 0.9 }, proposal());

    const entry = await run();

    expect(analyzer.received).toEqual(['spoken words']);
    expect(entry.rawTranscript).toBe('spoken words');
  });

  it('keeps the raw transcript when the model returns an empty cleanup', async () => {
    const { run } = capture(
      { text: 'mumbled but real', confidence: 0.9 },
      proposal({ cleanTranscript: '   ' }),
    );

    expect((await run()).cleanTranscript).toBe('mumbled but real');
  });

  it('refuses to build an entry out of silence', async () => {
    const { run } = capture({ text: '   ', confidence: 0.9 }, proposal());

    await expect(run()).rejects.toThrow(NothingWasSaidError);
  });

  it('treats an unusable confidence as the least sure it can be', async () => {
    const { run } = capture({ text: 'words', confidence: Number.NaN }, proposal());

    const entry = await run();

    expect(entry.confidence.level).toBe('low');
    expect(entry.needsUserReview).toBe(true);
  });

  it('takes its id and timestamp from the injected sources', async () => {
    const { run } = capture(CLEARLY_HEARD, proposal());

    const entry = await run();

    expect(entry.id).toBe('entry-1');
    expect(entry.createdAt).toEqual(NOW);
    expect(entry.source).toBe('voice');
    expect(entry.wasRevisedByUser).toBe(false);
  });
});
