import { opensWhileLocked, relocksAfter, RELOCK_AFTER_MS } from '@/presentation/screens/lockRules';

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
    for (const stage of ['recording', 'processing', 'turn', 'comparing', 'saving', 'saved'] as const) {
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
