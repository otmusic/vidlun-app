import type { Plan } from '@/domain/ports/IPurchases';
import { planOnSale } from '@/presentation/screens/planOnSale';
import { subscriptionFace } from '@/presentation/screens/subscriptionFace';

function plan(overrides: Partial<Plan> & Pick<Plan, 'kind' | 'amount'>): Plan {
  return {
    id: overrides.kind,
    price: '',
    trialDays: 0,
    ...overrides,
  };
}

const MONTHLY = plan({ kind: 'monthly', amount: 4.99 });
const ANNUAL = plan({ kind: 'annual', amount: 29.99, trialDays: 7 });
const LIFETIME = plan({ kind: 'lifetime', amount: 79.99 });

describe('the plan on sale', () => {
  it('sells the month alone, whatever else the store prices', () => {
    expect(planOnSale([ANNUAL, MONTHLY, LIFETIME])).toBe(MONTHLY);
  });

  it('has nothing to sell when the store prices no month', () => {
    expect(planOnSale([ANNUAL, LIFETIME])).toBeUndefined();
    expect(planOnSale([])).toBeUndefined();
  });
});

describe('what the subscription page shows', () => {
  it('waits quietly while the store has not answered yet', () => {
    expect(subscriptionFace('none', null)).toEqual({ kind: 'asking' });
  });

  it('says the store is quiet only once it has answered with nothing to sell', () => {
    expect(subscriptionFace('none', [])).toEqual({ kind: 'quiet' });
    expect(subscriptionFace('none', [ANNUAL, LIFETIME])).toEqual({ kind: 'quiet' });
  });

  it('offers the month once the store has priced it', () => {
    expect(subscriptionFace('none', [ANNUAL, MONTHLY])).toEqual({ kind: 'offer', plan: MONTHLY });
  });

  it('shows the receipt to someone who has it, whatever the store has said', () => {
    expect(subscriptionFace('trial', null)).toEqual({ kind: 'owned' });
    expect(subscriptionFace('subscribed', [])).toEqual({ kind: 'owned' });
  });
});
