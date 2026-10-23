import type { Plan } from '@/domain/ports/IPurchases';
import { planOnSale } from '@/presentation/screens/planOnSale';

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
