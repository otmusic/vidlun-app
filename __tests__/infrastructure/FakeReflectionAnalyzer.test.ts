import { FakeNarrativeGenerator } from '@/infrastructure/analysis/FakeNarrativeGenerator';
import { FakeObservationWriter } from '@/infrastructure/analysis/FakeObservationWriter';
import { FakeReflectionAnalyzer } from '@/infrastructure/analysis/FakeReflectionAnalyzer';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

describe('the pretend analysis for walking the card in development', () => {
  it('goes round a pleasant, a hard, a mixed and an ordinary reading in turn', async () => {
    const analyzer = new FakeReflectionAnalyzer(0);
    const moods = [];

    for (let turn = 0; turn < 5; turn += 1) {
      moods.push((await analyzer.analyze('Words.')).mood);
    }

    expect(moods).toEqual([5, 2, 4, 3, 5]);
  });

  it('names no topics, so no stand-in word is mistaken for a real tag', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze('Finished the quarterly report.');

    expect(reading.contextTags).toEqual([]);
  });

  it('keeps the words it was given', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze('Cooked dinner.');

    expect(reading.cleanTranscript).toBe('Cooked dinner.');
  });

  it('only ever names words the vocabulary has and Vidlun may propose', async () => {
    const vocabulary = createEmotionVocabulary();
    const analyzer = new FakeReflectionAnalyzer(0);

    for (let turn = 0; turn < 4; turn += 1) {
      const { emotionIds } = await analyzer.analyze('Words.');

      expect(vocabulary.keepProposableByAi(emotionIds)).toEqual(emotionIds);
    }
  });

  it('names nothing on the ordinary reading, the way a mundane entry should', async () => {
    const analyzer = new FakeReflectionAnalyzer(0);

    for (let turn = 0; turn < 3; turn += 1) {
      await analyzer.analyze('Words.');
    }

    expect((await analyzer.analyze('Cooked dinner.')).emotionIds).toEqual([]);
  });
});

describe('the pretend echo for walking the paid card in development', () => {
  it('answers with a sentence marked as pretend, quoting the entry', async () => {
    const echo = await new FakeObservationWriter(0).observe('Cooked dinner.');

    expect(echo).toContain('Pretend echo');
    expect(echo).toContain('Cooked dinner.');
  });
});

describe('the pretend month for walking the month page in development', () => {
  it('answers with prose marked as pretend, in paragraphs', async () => {
    const month = await new FakeNarrativeGenerator(0).generate([]);

    expect(month).toContain('Pretend month');
    expect(month.split('\n')).toHaveLength(2);
  });
});

