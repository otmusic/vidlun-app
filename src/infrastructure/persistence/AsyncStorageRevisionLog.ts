import type {
  DisagreementRecord,
  EntryRecords,
  EntryRevisionRecord,
  IRevisionLog,
} from '../../domain/ports/IRevisionLog';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
export const REVISION_KEY_PREFIX = 'vidlun.revision.';

/**
 * Its own prefix, so the two never have to be told apart by reading them. A
 * correction and a refusal answer different questions about the model, and a
 * later count that mixed them would be quietly wrong rather than obviously so.
 */
export const DISAGREEMENT_KEY_PREFIX = 'vidlun.disagreement.';

/**
 * Append-only while the entry lives. These records are the only evidence of
 * what Vidlun got wrong, and personalization later cannot be back-filled from
 * entries alone — but they go when the entry does.
 */
export class AsyncStorageRevisionLog implements IRevisionLog {
  constructor(private readonly store: IKeyValueStore) {}

  async record(revision: EntryRevisionRecord): Promise<void> {
    const revisedAt = revision.revisedAt.toISOString();
    const key = `${REVISION_KEY_PREFIX}${revision.entryId}.${revisedAt}`;

    await this.store.setItem(
      key,
      JSON.stringify({
        entryId: revision.entryId,
        revisedAt,
        proposedMood: revision.proposedMood,
        finalMood: revision.finalMood,
        proposedEmotionIds: [...revision.proposedEmotionIds],
        finalEmotionIds: [...revision.finalEmotionIds],
      }),
    );
  }

  async disagree(disagreement: DisagreementRecord): Promise<void> {
    const at = disagreement.at.toISOString();
    const key = `${DISAGREEMENT_KEY_PREFIX}${disagreement.entryId}.${at}`;

    await this.store.setItem(
      key,
      JSON.stringify({
        entryId: disagreement.entryId,
        at,
        proposedEmotionIds: [...disagreement.proposedEmotionIds],
        selfEmotionIds: [...disagreement.selfEmotionIds],
      }),
    );
  }

  async recordsOf(entryId: string): Promise<EntryRecords> {
    const keys = await this.store.getAllKeys();
    const read = async (prefix: string): Promise<unknown[]> => {
      const values = await Promise.all(
        keys
          .filter((key) => key.startsWith(`${prefix}${entryId}.`))
          .map((key) => this.store.getItem(key)),
      );

      return values.flatMap((raw) => {
        try {
          return raw === null ? [] : [JSON.parse(raw) as unknown];
        } catch {
          return [];
        }
      });
    };

    const revisions = (await read(REVISION_KEY_PREFIX)).flatMap((value) => {
      const record = revisionFrom(value);

      return record === null ? [] : [record];
    });
    const disagreements = (await read(DISAGREEMENT_KEY_PREFIX)).flatMap((value) => {
      const record = disagreementFrom(value);

      return record === null ? [] : [record];
    });

    return { revisions, disagreements };
  }

  async forget(entryId: string): Promise<void> {
    // One entry can carry several of each, keyed by when they happened, so
    // this is a prefix sweep rather than a single removal. Both prefixes: a
    // refusal is made of what the person said and does not get to outlive the
    // entry they removed either.
    const prefixes = [
      `${REVISION_KEY_PREFIX}${entryId}.`,
      `${DISAGREEMENT_KEY_PREFIX}${entryId}.`,
    ];
    const keys = (await this.store.getAllKeys()).filter((key) =>
      prefixes.some((prefix) => key.startsWith(prefix)),
    );

    await Promise.all(keys.map((key) => this.store.removeItem(key)));
  }
}

/** A stored revision read back, or null where it is not one. */
function revisionFrom(value: unknown): EntryRevisionRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const revisedAt = typeof record.revisedAt === 'string' ? new Date(record.revisedAt) : null;

  if (typeof record.entryId !== 'string' || revisedAt === null || Number.isNaN(revisedAt.getTime())) {
    return null;
  }

  return {
    entryId: record.entryId,
    revisedAt,
    proposedMood: typeof record.proposedMood === 'number' ? record.proposedMood : null,
    finalMood: typeof record.finalMood === 'number' ? record.finalMood : null,
    proposedEmotionIds: strings(record.proposedEmotionIds),
    finalEmotionIds: strings(record.finalEmotionIds),
  };
}

/** A stored disagreement read back, or null where it is not one. */
function disagreementFrom(value: unknown): DisagreementRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const at = typeof record.at === 'string' ? new Date(record.at) : null;

  if (typeof record.entryId !== 'string' || at === null || Number.isNaN(at.getTime())) {
    return null;
  }

  return {
    entryId: record.entryId,
    at,
    proposedEmotionIds: strings(record.proposedEmotionIds),
    selfEmotionIds: strings(record.selfEmotionIds),
  };
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
