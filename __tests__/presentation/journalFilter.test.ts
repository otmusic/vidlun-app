import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { emotionsUsed, entriesWithAny } from '@/presentation/screens/journalFilter';

let nextId = 0;

function entry(emotionIds: readonly string[]): MoodEntry {
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
