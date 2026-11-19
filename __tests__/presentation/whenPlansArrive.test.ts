import type { Plan } from '@/domain/ports/IPurchases';
import {
  whenPlansArrive,
  whenPlansAsked,
  type CaptureStage,
} from '@/presentation/hooks/useCaptureFlow';

const MONTHLY: Plan = { id: 'monthly', kind: 'monthly', price: '$3.99', amount: 3.99, trialDays: 3 };

const asking: CaptureStage = { kind: 'subscription', plans: null, ask: 2, outcome: null };

describe('asking the store for its plans', () => {
  it('opens the page waiting, with nothing priced and nothing said yet', () => {
    expect(whenPlansAsked(1)).toEqual({ kind: 'subscription', plans: null, ask: 1, outcome: null });
  });

  it('waits again on "try again", under a new ask the earlier answer cannot land on', () => {
    const retry = whenPlansAsked(2);

    expect(retry).toMatchObject({ plans: null, ask: 2 });
    expect(whenPlansArrive(retry, [], 1)).toBe(retry);
  });
});

describe('when the plans arrive', () => {
  it('prices the page with what the store answered', () => {
    expect(whenPlansArrive(asking, [MONTHLY], 2)).toEqual({ ...asking, plans: [MONTHLY] });
  });

  it('keeps an empty answer as an answer, apart from still waiting', () => {
    expect(whenPlansArrive(asking, [], 2)).toEqual({ ...asking, plans: [] });
  });

  it('drops a late answer to an earlier ask, so a newer wait is not called quiet', () => {
    expect(whenPlansArrive(asking, [], 1)).toBe(asking);
  });

  it('leaves the stage alone once the person has left the page', () => {
    const idle: CaptureStage = { kind: 'idle' };

    expect(whenPlansArrive(idle, [MONTHLY], 2)).toBe(idle);
  });
});
