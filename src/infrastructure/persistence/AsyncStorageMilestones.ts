import { Milestone } from '../../domain/entities/Milestone';
import type { IMilestoneRepository } from '../../domain/ports/IMilestoneRepository';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.milestones';

interface Stored {
  readonly id: string;
  /** The local calendar day as YYYY-MM-DD, so a milestone never drifts across midnight with a time zone. */
  readonly day: string;
  readonly label: string;
}

/**
 * One record for the whole line. A person marks a handful of milestones a
 * year, and reading them all every time is cheaper than a key per milestone
 * would be to keep consistent.
 */
export class AsyncStorageMilestones implements IMilestoneRepository {
  constructor(private readonly store: IKeyValueStore) {}

  async findAll(): Promise<readonly Milestone[]> {
    return (await this.read()).sort((a, b) => a.day.getTime() - b.day.getTime());
  }

  async save(milestone: Milestone): Promise<void> {
    const others = (await this.read()).filter((m) => m.id !== milestone.id);

    await this.write([...others, milestone]);
  }

  async delete(id: string): Promise<void> {
    const kept = (await this.read()).filter((m) => m.id !== id);

    await this.write(kept);
  }

  private async read(): Promise<Milestone[]> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed.flatMap(restore) : [];
    } catch {
      // A record nothing can read is nothing to build on; the next save rewrites it.
      return [];
    }
  }

  private async write(milestones: readonly Milestone[]): Promise<void> {
    if (milestones.length === 0) {
      await this.store.removeItem(KEY);

      return;
    }

    const stored: Stored[] = milestones.map((m) => ({ id: m.id, day: dayString(m.day), label: m.label }));

    await this.store.setItem(KEY, JSON.stringify(stored));
  }
}

function restore(value: unknown): Milestone[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const { id, day, label } = value as { id?: unknown; day?: unknown; label?: unknown };

  if (typeof id !== 'string' || typeof day !== 'string' || typeof label !== 'string') {
    return [];
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);

  if (match === null) {
    return [];
  }

  try {
    return [
      Milestone.create({
        id,
        day: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
        label,
      }),
    ];
  } catch {
    return [];
  }
}

function dayString(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${String(day.getFullYear())}-${month}-${date}`;
}
