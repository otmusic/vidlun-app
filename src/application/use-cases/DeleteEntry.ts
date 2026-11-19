import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IRevisionLog } from '../../domain/ports/IRevisionLog';
import type { IVoiceReadings } from '../../domain/ports/IVoiceReadings';

/** A deletion that can still be taken back, for as long as the screen offers it. */
export interface DeletedEntry {
  /**
   * Puts back everything the deletion removed: the entry, its voice, what
   * was measured in the voice and what was revised. Nothing after `settle`.
   */
  restore(): Promise<void>;
  /** Lets the voice go for good, the one thing still held. Nothing after `restore`. */
  settle(): Promise<void>;
}

/**
 * Removes an entry and everything the app kept because of it.
 *
 * A journal that quietly holds onto what you deleted is worse than one that
 * loses it, and that includes the voice. So the undo (owner's word,
 * 2026-11-19: five seconds, a ring counting down) holds nothing in storage:
 * the entry, its revisions and its measurements are gone from it at once
 * and live only in this object's memory, and the voice waits in the cache,
 * which the next launch sweeps. Closing the app in between is as final as
 * letting the five seconds pass.
 */
export class DeleteEntry {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly revisionLog: IRevisionLog,
    private readonly recordings: IRecordingStore,
    private readonly voiceReadings: IVoiceReadings,
  ) {}

  async execute(id: string): Promise<DeletedEntry> {
    // Read first, while it is all still there to read.
    const entry = await this.repository.findById(id);
    const records = await this.revisionLog.recordsOf(id);
    const reading = await this.voiceReadings.find(id);

    // The entry goes first. If forgetting the diff fails afterwards, the user
    // still sees the thing they asked to remove actually gone.
    await this.repository.delete(id);
    await this.revisionLog.forget(id);

    const heldVoice = await this.recordings.setAside(id);

    // What was measured in the voice goes with the voice.
    await this.voiceReadings.forget(id);

    let open = true;

    return {
      restore: async () => {
        if (!open) {
          return;
        }

        open = false;

        if (entry !== null) {
          await this.repository.save(entry);
        }

        for (const revision of records.revisions) {
          await this.revisionLog.record(revision);
        }

        for (const disagreement of records.disagreements) {
          await this.revisionLog.disagree(disagreement);
        }

        if (heldVoice !== null) {
          await this.recordings.keep(id, heldVoice);
        }

        if (reading !== null) {
          await this.voiceReadings.save(id, reading);
        }
      },
      settle: async () => {
        if (!open) {
          return;
        }

        open = false;

        if (heldVoice !== null) {
          await this.recordings.release(heldVoice);
        }
      },
    };
  }
}
