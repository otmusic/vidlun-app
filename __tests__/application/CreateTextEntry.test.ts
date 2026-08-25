import { CreateTextEntry } from '@/application/use-cases/CreateTextEntry';
import { NothingWasSaidError } from '@/domain/errors/MoodEntryErrors';
import type { ReflectionProposal } from '@/domain/ports/IReflectionAnalyzer';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { FixedClock, proposal, SequentialIdGenerator, StubReflectionAnalyzer } from './fakes';

const NOW = new Date('2026-08-01T09:00:00.000Z');
const vocabulary = createEmotionVocabulary();

function useCase(proposed: ReflectionProposal) {
  const analyzer = new StubReflectionAnalyzer(proposed);

  return {
    analyzer,
    subject: new CreateTextEntry(analyzer, vocabulary, new FixedClock(NOW), new SequentialIdGenerator()),
  };
}

describe('CreateTextEntry', () => {
  it('marks the entry as typed rather than spoken', async () => {
    const { subject } = useCase(proposal());

    const entry = await subject.execute('Finished three tasks.');

    expect(entry.source).toBe('text');
    expect(entry.id).toBe('entry-1');
    expect(entry.createdAt).toEqual(NOW);
  });

  it('trusts typed words completely, so nothing is broadened', async () => {
    const { subject } = useCase(
      proposal({ emotionIds: ['happy.proud.successful', 'bad.tired.drained'] }),
    );

    const entry = await subject.execute('Finished three tasks, happy, but very tired.');

    expect(entry.confidence.value).toBe(1);
    expect(entry.needsUserReview).toBe(false);
    expect(entry.emotionIds).toEqual(['happy.proud.successful', 'bad.tired.drained']);
  });

  it('reads the trimmed text, and keeps it as the raw transcript', async () => {
    const { analyzer, subject } = useCase(proposal());

    const entry = await subject.execute('   Cooked dinner.   ');

    expect(analyzer.received).toEqual(['Cooked dinner.']);
    expect(entry.rawTranscript).toBe('Cooked dinner.');
  });

  it('refuses an empty note', async () => {
    const { subject } = useCase(proposal());

    await expect(subject.execute('   ')).rejects.toThrow(NothingWasSaidError);
  });

  it('applies the same rules a spoken entry gets', async () => {
    const { subject } = useCase(
      proposal({ mood: 9, emotionIds: ['fearful.weak.worthless', 'not_real'], safetyFlag: 'crisis' }),
    );

    const entry = await subject.execute('Something heavy.');

    expect(entry.mood.value).toBe(5);
    expect(entry.emotionIds).toEqual([]);
    expect(entry.observation).toBeNull();
  });
});
