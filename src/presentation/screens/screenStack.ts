import type { CaptureStage } from '../hooks/useCaptureFlow';

/**
 * The screens kept under the one on top, so a swipe back shows where it goes
 * and lands there as it was left, scroll and all (owner's word, 2026-11-24).
 * Only screens that hold nothing playing: a month heard in its own voice, or
 * a card with its take, would go on sounding under the page above them.
 */
const KEPT_UNDER: ReadonlySet<string> = new Set(['idle', 'history', 'stats', 'months', 'subscription']);

/** How many screens are remembered under the top; only the one right under it is drawn. */
const DEPTH = 3;

/** Which screen a stage is: an entry's page is one per entry, the rest one per kind. */
export function screenKeyOf(stage: CaptureStage): string {
  return stage.kind === 'detail' ? `detail:${stage.entry.id}` : stage.kind;
}

/** The screen a stage's back button and swipe go to; null where they go nowhere, or somewhere not kept. */
export function backKeyOf(stage: CaptureStage): string | null {
  switch (stage.kind) {
    case 'writing':
    case 'stats':
    case 'subscription':
      return 'idle';
    case 'month':
      return stage.from;
    case 'months':
    case 'vocabulary':
      return 'stats';
    case 'legal':
      return 'subscription';
    case 'detail':
      return stage.backTo === null ? stage.from : 'month';
    default:
      return null;
  }
}

/**
 * The stack once `next` is on screen: the same screen updated in place, the
 * one under it come back to, or a screen opened over the top. Anything else
 * starts again from `next` alone.
 */
export function nextStack(stack: readonly CaptureStage[], next: CaptureStage): readonly CaptureStage[] {
  const key = screenKeyOf(next);
  const top = stack[stack.length - 1];
  const below = stack[stack.length - 2];

  if (top !== undefined && screenKeyOf(top) === key) {
    return [...stack.slice(0, -1), next];
  }

  if (below !== undefined && screenKeyOf(below) === key) {
    return [...stack.slice(0, -2), next];
  }

  if (top !== undefined && KEPT_UNDER.has(screenKeyOf(top)) && backKeyOf(next) === screenKeyOf(top)) {
    return [...stack, next].slice(-DEPTH);
  }

  return [next];
}
