import type { Theme } from '@/application/use-cases/GetWeekThemes';

/**
 * Which topics section the week shows: the topics themselves with a
 * subscription, the lock over them without one, and nothing when the week
 * named no topics at all. The lock is a promise that there is something
 * behind it, so it stands only over topics that exist; before 2026-10-30 it
 * stood over every week, and whoever paid to open an empty one found the
 * section gone.
 *
 * Its own file rather than a line inside the screen, so the rule can be
 * tested without a renderer.
 */
export function topicsSection(view: {
  readonly hasNarrativeAccess: boolean;
  readonly themes: readonly Theme[];
}): 'open' | 'locked' | null {
  if (view.themes.length === 0) {
    return null;
  }

  return view.hasNarrativeAccess ? 'open' : 'locked';
}
