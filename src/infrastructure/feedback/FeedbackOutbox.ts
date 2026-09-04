import type { IClock } from '../../domain/ports/IClock';
import type { IFeedbackSender } from '../../domain/ports/IFeedbackSender';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.feedbackOutbox';

interface Note {
  readonly id: string;
  readonly text: string;
  readonly writtenAt: string;
}

/**
 * Keeps a note until it has been mailed.
 *
 * The sheet closes the moment the person taps send — a modal that waits on
 * the network is a modal that hangs — so delivery has to outlive the sheet:
 * the note is written down first and mailed second, and one that would not
 * go is tried again at the next flush, this launch or a later one. A note
 * that quietly vanished would be the worst possible answer to "what broke".
 *
 * Nothing here is a record of what anyone wrote: a note is on disk only
 * between the tap and the moment the proxy took it.
 */
export class FeedbackOutbox implements IFeedbackSender {
  private flushing: Promise<void> | null = null;
  /** Reads and writes of the list take turns, so two of them cannot drop each other's note. */
  private turn: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: IKeyValueStore,
    private readonly sender: IFeedbackSender,
    private readonly ids: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  /** Resolves once the note is kept, not once it is mailed. */
  async send(text: string): Promise<void> {
    const note: Note = { id: this.ids.next(), text, writtenAt: this.clock.now().toISOString() };

    await this.change((pending) => [...pending, note]);

    void this.flush();
  }

  /**
   * Mails what is waiting, oldest first, and stops at the first that will
   * not go. Safe to call from anywhere at any time: a second call joins the
   * flush already running rather than mailing the same note twice.
   */
  flush(): Promise<void> {
    this.flushing ??= this.drain().finally(() => {
      this.flushing = null;
    });

    return this.flushing;
  }

  private async drain(): Promise<void> {
    for (;;) {
      const next = (await this.pending())[0];

      if (next === undefined) {
        return;
      }

      try {
        await this.sender.send(next.text);
      } catch {
        // Left where it is; the next flush tries again.
        return;
      }

      // Removed by id rather than by position: a note may have been written
      // while this one was on its way.
      await this.change((pending) => pending.filter((note) => note.id !== next.id));
    }
  }

  private change(edit: (pending: readonly Note[]) => readonly Note[]): Promise<void> {
    const work = async (): Promise<void> => {
      const edited = edit(await this.pending());

      if (edited.length === 0) {
        await this.store.removeItem(KEY);
      } else {
        await this.store.setItem(KEY, JSON.stringify(edited));
      }
    };
    const result = this.turn.then(work, work);

    this.turn = result.catch(() => undefined);

    return result;
  }

  private async pending(): Promise<readonly Note[]> {
    const raw = await this.store.getItem(KEY);

    return raw === null ? [] : readNotes(raw);
  }
}

function readNotes(raw: string): readonly Note[] {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isNote);
  } catch {
    return [];
  }
}

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { id, text, writtenAt } = value as { id?: unknown; text?: unknown; writtenAt?: unknown };

  return typeof id === 'string' && typeof text === 'string' && typeof writtenAt === 'string';
}
