import { opensWhileLocked, relocksAfter, relocksAway, RELOCK_AFTER_MS } from '@/presentation/screens/lockRules';

describe('the journal lock', () => {
  it('forgives stepping out to answer a message', () => {
    expect(relocksAfter(10_000)).toBe(false);
    expect(relocksAfter(RELOCK_AFTER_MS)).toBe(false);
  });

  it('shuts again after more than a minute away', () => {
    expect(relocksAfter(RELOCK_AFTER_MS + 1)).toBe(true);
    expect(relocksAfter(60 * 60 * 1000)).toBe(true);
  });

  it('lets a take started from outside run to its save without Face ID', () => {
    for (const stage of ['recording', 'processing', 'turn', 'saving', 'saved'] as const) {
      expect(opensWhileLocked(stage)).toBe(true);
    }
  });

  it('keeps every page that shows earlier entries behind the door', () => {
    for (const stage of ['idle', 'history', 'detail', 'settings', 'stats', 'month', 'months'] as const) {
      expect(opensWhileLocked(stage)).toBe(false);
    }
  });

  it('keeps typing behind the door, since only a take from outside skips it', () => {
    expect(opensWhileLocked('writing')).toBe(false);
  });
});

describe('an absence measured twice', () => {
  it('forgives a short absence on both clocks', () => {
    expect(relocksAway({ wallMs: 20_000, steadyMs: 20_000 })).toBe(false);
  });

  it('shuts the journal when the phone stayed awake past the minute, whatever the wall clock says', () => {
    expect(relocksAway({ wallMs: 30_000, steadyMs: 10 * 60_000 })).toBe(true);
  });

  it('shuts it when the wall clock went backwards', () => {
    expect(relocksAway({ wallMs: -5_000, steadyMs: 1_000 })).toBe(true);
  });

  it('shuts it after a long sleep, which only the wall clock counts', () => {
    expect(relocksAway({ wallMs: 30 * 60_000, steadyMs: 2_000 })).toBe(true);
  });
});
