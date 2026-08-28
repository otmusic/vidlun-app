import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { IObservationWriter } from '@/domain/ports/IObservationWriter';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { WriteObservation } from '@/application/use-cases/WriteObservation';

class FakeWriter implements IObservationWriter {
  seen: string[] = [];

  constructor(private readonly sentence: string | null) {}

  observe(transcript: string): Promise<string | null> {
    this.seen.push(transcript);

    return Promise.resolve(this.sentence);
  }
}

function draft(safetyFlag: 'none' | 'distress' | 'crisis' = 'none'): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: new Date('2026-08-25T18:00:00.000Z'),
    source: 'voice',
    rawTranscript: 'finished three tasks happy but very tired',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud'],
    confidence: Confidence.of(0.9),
    safetyFlag,
  });
}

describe('WriteObservation', () => {
  it('writes the sentence into a draft that had none', async () => {
    const entry = await new WriteObservation(new FakeWriter('Quietly done.')).execute(draft());

    expect(entry.observation).toBe('Quietly done.');
  });

  it('leaves the rest of the draft alone', async () => {
    const original = draft();
    const entry = await new WriteObservation(new FakeWriter('Quietly done.')).execute(original);

    expect(entry.id).toBe(original.id);
    expect(entry.mood?.value).toBe(original.mood?.value);
    expect(entry.emotionIds).toEqual(original.emotionIds);
    expect(entry.wasRevisedByUser).toBe(false);
  });

  it('reads the repaired transcript, not what the recogniser first heard', async () => {
    const writer = new FakeWriter(null);

    await new WriteObservation(writer).execute(draft());

    expect(writer.seen).toEqual(['Finished three tasks, happy, but very tired.']);
  });

  it('still says nothing on a crisis entry, whatever the model wrote', async () => {
    const entry = await new WriteObservation(new FakeWriter('What a productive day!')).execute(
      draft('crisis'),
    );

    expect(entry.observation).toBeNull();
  });

  it('accepts silence as an answer', async () => {
    expect((await new WriteObservation(new FakeWriter(null)).execute(draft())).observation).toBeNull();
  });
});
