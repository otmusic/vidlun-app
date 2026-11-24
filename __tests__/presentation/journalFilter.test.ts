import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  emotionsUsed,
  entriesMatching,
  entriesWithAny,
  filterSize,
  NO_FILTER,
  topicsUsed,
} from '@/presentation/screens/journalFilter';

let nextId = 0;

function entry(emotionIds: readonly string[], contextTags: readonly string[] = []): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: new Date(2026, 9, nextId, 21, 0),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
    emotionIds,
    contextTags,
  });
}

describe('the journal filtered by emotion', () => {
  const calm = entry(['happy.peaceful']);
  const both = entry(['happy.peaceful', 'bad.tired']);
  const tired = entry(['bad.tired']);
  const tiredAgain = entry(['bad.tired']);
  const none = entry([]);
  const journal = [calm, both, tired, tiredAgain, none];

  it('offers the emotions this person has used, the most used first', () => {
    expect(emotionsUsed(journal)).toEqual(['bad.tired', 'happy.peaceful']);
  });

  it('shows every entry while nothing is chosen', () => {
    expect(entriesWithAny(journal, [])).toEqual(journal);
  });

  it('shows the entries holding any of the chosen emotions', () => {
    expect(entriesWithAny(journal, ['happy.peaceful'])).toEqual([calm, both]);
    expect(entriesWithAny(journal, ['happy.peaceful', 'bad.tired'])).toEqual([
      calm,
      both,
      tired,
      tiredAgain,
    ]);
  });
});

describe('the journal filtered by topic', () => {
  const calmAtWork = entry(['happy.peaceful'], ['work']);
  const tiredAtWork = entry(['bad.tired'], ['work', 'sleep']);
  const tiredAtNight = entry(['bad.tired'], ['sleep']);
  const walk = entry([], ['walk']);
  const journal = [calmAtWork, tiredAtWork, tiredAtNight, walk];

  it('offers the topics this person has had, the most used first', () => {
    expect(topicsUsed(journal)).toEqual(['sleep', 'work', 'walk']);
  });

  it('shows every entry while nothing is chosen', () => {
    expect(entriesMatching(journal, NO_FILTER)).toEqual(journal);
  });

  it('shows the entries with any of the chosen topics', () => {
    expect(entriesMatching(journal, { emotionIds: [], topics: ['work', 'walk'] })).toEqual([
      calmAtWork,
      tiredAtWork,
      walk,
    ]);
  });

  it('asks for one of each when both emotions and topics are chosen', () => {
    expect(entriesMatching(journal, { emotionIds: ['bad.tired'], topics: ['work'] })).toEqual([tiredAtWork]);
  });

  it('counts every chosen word for the badge', () => {
    expect(filterSize({ emotionIds: ['bad.tired'], topics: ['work', 'sleep'] })).toBe(3);
  });
});
