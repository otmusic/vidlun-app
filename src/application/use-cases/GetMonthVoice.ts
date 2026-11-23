import type { MonthVoice, VoicedEntry } from '../../domain/entities/MonthVoice';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IVoiceMontage } from '../../domain/ports/IVoiceMontage';

/**
 * What of a month can be heard in its own voice (owner's word, 2026-11-23):
 * every entry that kept its voice, first to last, a hard one as much as any
 * (owner's word: every entry is heard). A typed entry has no voice, nor has
 * one recorded while keeping recordings was off; both are simply not in it.
 *
 * Null when there is nothing to hear, or nothing on this phone can measure
 * the takes: then the month page has no player at all.
 */
export class GetMonthVoice {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly recordings: IRecordingStore,
    private readonly montage: Pick<IVoiceMontage, 'lengths'>,
  ) {}

  async execute(month: Date): Promise<MonthVoice | null> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const entries = [...(await this.repository.findBetween(monthStart, monthEnd))].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const withAudio = await this.recordings.withAudio();
    const spoken = entries.filter((entry) => withAudio.has(entry.id));
    const uris = await Promise.all(spoken.map((entry) => this.recordings.find(entry.id)));
    const found = spoken.flatMap((entry, at) => {
      const uri = uris[at];

      return uri === null || uri === undefined ? [] : [{ entry, uri }];
    });

    if (found.length === 0) {
      return null;
    }

    const lengths = await this.montage.lengths(found.map(({ uri }) => uri));

    if (lengths === null) {
      return null;
    }

    const voiced = found.flatMap(({ entry, uri }, at): VoicedEntry[] => {
      const lengthMs = lengths[at];

      return lengthMs === null || lengthMs === undefined || lengthMs <= 0 ? [] : [{ entry, uri, lengthMs }];
    });

    return voiced.length === 0 ? null : { monthStart, voiced };
  }
}
