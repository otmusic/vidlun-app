import { ComposeMonthVoice } from '@/application/use-cases/ComposeMonthVoice';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { GLIMPSE_MS, MONTH_VOICE_GAP_MS, type MonthVoice } from '@/domain/entities/MonthVoice';
import type { Montage, MontagePiece, MontageTiming } from '@/domain/ports/IVoiceMontage';
import { Confidence } from '@/domain/value-objects/Confidence';

function entry(id: string): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 9, 9),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Said.',
    mood: null,
    confidence: Confidence.of(0.9),
  });
}

const voice: MonthVoice = {
  monthStart: new Date(2026, 9, 1),
  voiced: [
    { entry: entry('a'), uri: 'file:///a.m4a', lengthMs: 4_000 },
    { entry: entry('b'), uri: 'file:///b.m4a', lengthMs: 30_000 },
    { entry: entry('c'), uri: 'file:///c.m4a', lengthMs: 12_000 },
  ],
};

/** Joins pieces end to end; can be told one piece cannot be read, or that nothing can join. */
class FakeMontage {
  readonly joined: { readonly pieces: readonly MontagePiece[]; readonly timing: MontageTiming }[] = [];
  unreadable: string | null = null;
  absent = false;
  cleared = 0;

  join(pieces: readonly MontagePiece[], timing: MontageTiming): Promise<Montage | null> {
    this.joined.push({ pieces, timing });

    if (this.absent) {
      return Promise.resolve(null);
    }

    let cursor = 0;

    return Promise.resolve({
      uri: 'file:///cache/month-voice/month.m4a',
      spans: pieces.map((piece) => {
        if (piece.uri === this.unreadable) {
          return null;
        }

        const span = { startMs: cursor, endMs: cursor + piece.toMs - piece.fromMs };

        cursor = span.endMs + timing.gapMs;

        return span;
      }),
    });
  }

  clear(): Promise<void> {
    this.cleared += 1;

    return Promise.reject(new Error('the folder would not go'));
  }
}

describe('ComposeMonthVoice', () => {
  it('joins ten seconds of each take, fading out only the ones cut short', async () => {
    const montage = new FakeMontage();
    const played = await new ComposeMonthVoice(montage).execute(voice, 'glimpse');

    expect(montage.joined[0]?.pieces).toEqual([
      { uri: 'file:///a.m4a', fromMs: 0, toMs: 4_000, fadeOut: false },
      { uri: 'file:///b.m4a', fromMs: 0, toMs: GLIMPSE_MS, fadeOut: true },
      { uri: 'file:///c.m4a', fromMs: 0, toMs: GLIMPSE_MS, fadeOut: true },
    ]);
    expect(montage.joined[0]?.timing.gapMs).toBe(MONTH_VOICE_GAP_MS);
    expect(played?.parts.map(({ entry, startMs }) => [entry.id, startMs])).toEqual([
      ['a', 0],
      ['b', 4_000 + MONTH_VOICE_GAP_MS],
      ['c', 4_000 + GLIMPSE_MS + 2 * MONTH_VOICE_GAP_MS],
    ]);
  });

  it('leaves out a take that could not be joined, keeping the rest', async () => {
    const montage = new FakeMontage();

    montage.unreadable = 'file:///b.m4a';

    const played = await new ComposeMonthVoice(montage).execute(voice, 'whole');

    expect(played?.parts.map(({ entry }) => entry.id)).toEqual(['a', 'c']);
  });

  it('has nothing to play when nothing can join the takes', async () => {
    const montage = new FakeMontage();

    montage.absent = true;

    expect(await new ComposeMonthVoice(montage).execute(voice, 'glimpse')).toBeNull();
  });

  it('lets the joined file go without ever failing', async () => {
    const montage = new FakeMontage();

    await expect(new ComposeMonthVoice(montage).forget()).resolves.toBeUndefined();
    expect(montage.cleared).toBe(1);
  });
});
