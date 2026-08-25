import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { MismatchedDraftError } from '../../domain/errors/MoodEntryErrors';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IRevisionLog } from '../../domain/ports/IRevisionLog';

export interface ConfirmEntryInput {
  /** What Luna offered on the reflection card. */
  readonly proposed: MoodEntry;
  /** What the user kept — the same entry when they changed nothing. */
  readonly confirmed: MoodEntry;
  /** The take this came from, absent for a typed entry. */
  readonly recordingUri?: string;
}

/** The only use case that writes. */
export class ConfirmEntry {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly revisionLog: IRevisionLog,
    private readonly clock: IClock,
    private readonly recordings: IRecordingStore,
  ) {}

  async execute(input: ConfirmEntryInput): Promise<MoodEntry> {
    const { proposed, confirmed } = input;

    if (proposed.id !== confirmed.id) {
      throw new MismatchedDraftError(proposed.id, confirmed.id);
    }

    await this.repository.save(confirmed);

    /*
     * Only now, and only here. Drafts are not persisted, so a take the user
     * walked away from stays in the recorder's scratch space and is cleaned up
     * with it — confirming is the moment the recording becomes theirs to keep.
     *
     * Failing here must not cost them the entry. An entry without its audio is
     * complete; an entry lost because a file move failed is not.
     */
    if (input.recordingUri !== undefined) {
      await this.recordings.keep(confirmed.id, input.recordingUri).catch(() => undefined);
    }

    // Saving is the user's intent; logging is ours. Never let the second
    // failing take the first with it.
    if (confirmed.wasRevisedByUser) {
      await this.revisionLog.record({
        entryId: confirmed.id,
        revisedAt: this.clock.now(),
        proposedMood: proposed.mood.value,
        finalMood: confirmed.mood.value,
        proposedEmotionIds: proposed.emotionIds,
        finalEmotionIds: confirmed.emotionIds,
      });
    }

    return confirmed;
  }
}
