import type { CaptureFlow } from '../hooks/useCaptureFlow';

/**
 * How long an absence stays forgiven. Under a minute is answering a message;
 * over it, the phone has plausibly changed hands.
 */
export const RELOCK_AFTER_MS = 60_000;

/** Whether coming back after this long away shuts the journal again. */
export function relocksAfter(awayMs: number): boolean {
  return awayMs > RELOCK_AFTER_MS;
}

/**
 * The same, measured twice. The wall clock alone could be set back in
 * Settings — no passcode needed on an unlocked phone — and the journal
 * opened without Face ID ten minutes after its owner left it (security
 * review, 2026-11-26). The steady clock cannot be set; it stands while the
 * phone sleeps, but a sleeping phone is locked, and then the wall clock
 * counts. A wall clock that went backwards shuts it too.
 */
export function relocksAway(away: { readonly wallMs: number; readonly steadyMs: number }): boolean {
  return away.wallMs < 0 || relocksAfter(away.wallMs) || relocksAfter(away.steadyMs);
}

/**
 * The stages a take passes through, which stay open while the journal is
 * shut (owner's word, 2026-11-20): a recording started from a widget, Siri,
 * the Control Center or the Action Button goes ahead without Face ID, since
 * these screens show only what was just said. Anyone can add to the journal;
 * only its owner can read it. Everything else waits behind the door, which
 * stands again the moment the take is saved or let go.
 */
const OPEN_WHILE_LOCKED: ReadonlySet<CaptureFlow['stage']['kind']> = new Set([
  'recording',
  'processing',
  'turn',
  'reflecting',
  'saving',
  'saved',
  'grounding',
]);

export function opensWhileLocked(stage: CaptureFlow['stage']['kind']): boolean {
  return OPEN_WHILE_LOCKED.has(stage);
}
