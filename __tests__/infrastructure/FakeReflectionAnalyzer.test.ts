import { FakeNarrativeGenerator } from '@/infrastructure/analysis/FakeNarrativeGenerator';
import { FakeObservationWriter } from '@/infrastructure/analysis/FakeObservationWriter';
import { FakeReflectionAnalyzer } from '@/infrastructure/analysis/FakeReflectionAnalyzer';
import TOPICS from '@/infrastructure/analysis/fakeTopics.json';
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

  it('names a topic in its dictionary form, whatever form the word came in', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze('Studied for the exams all evening.');

    // Owner's word, 2026-10-01: a topic copied from the sentence kept the
    // sentence's ending; the card shows the word itself.
    expect(reading.contextTags).toEqual(['study']);
  });

  it('takes the longest sign, so a workout is the gym rather than work', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze('A long «Workout».');

    expect(reading.contextTags).toEqual(['gym']);
  });

  it('matches a short word only whole, so a moment is not a mom', async () => {
    const analyzer = new FakeReflectionAnalyzer(0);

    expect((await analyzer.analyze('A quiet moment.')).contextTags).toEqual([]);
    expect((await analyzer.analyze('A quiet moment with mom.')).contextTags).toEqual(['family']);
  });

  it('names nothing for words it does not know', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze('Ok. All fine.');

    expect(reading.contextTags).toEqual([]);
  });

  it('names each topic once and three at most, in the order they were said', async () => {
    const reading = await new FakeReflectionAnalyzer(0).analyze(
      'Work, then the gym, then work again, sleep, money.',
    );

    expect(reading.contextTags).toEqual(['work', 'gym', 'sleep']);
  });

  it('knows every topic by at least one lowercase word or beginning of one', () => {
    for (const sign of TOPICS) {
      const signs = [...sign.words, ...sign.stems];

      expect(signs.length).toBeGreaterThan(0);
      expect(signs.every((each) => each === each.toLowerCase() && each.trim() === each)).toBe(true);
    }
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

