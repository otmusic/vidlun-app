import type { Plan } from '@/domain/ports/IPurchases';
import { savingAgainstMonthly } from '@/presentation/screens/planSaving';

function plan(overrides: Partial<Plan> & Pick<Plan, 'kind' | 'amount'>): Plan {
  return {
    id: overrides.kind,
    price: '',
    trialDays: 0,
    ...overrides,
  };
}

const MONTHLY = plan({ kind: 'monthly', amount: 199 });
const ANNUAL = plan({ kind: 'annual', amount: 999, trialDays: 7 });
const LIFETIME = plan({ kind: 'lifetime', amount: 2999 });

describe('savingAgainstMonthly', () => {
  it('reads the year against twelve of the month', () => {
    // 999 of 2388, rounded down rather than up: a claim of 59 would be a
    // percent we do not have.
    expect(savingAgainstMonthly(ANNUAL, [MONTHLY, ANNUAL, LIFETIME])).toBe(58);
  });

  it('says nothing of the month itself', () => {
    expect(savingAgainstMonthly(MONTHLY, [MONTHLY, ANNUAL])).toBeNull();
  });

  it('says nothing of the lifetime, which is not a year of anything', () => {
    expect(savingAgainstMonthly(LIFETIME, [MONTHLY, ANNUAL, LIFETIME])).toBeNull();
  });

  it('claims no discount when there is no month to compare with', () => {
    expect(savingAgainstMonthly(ANNUAL, [ANNUAL])).toBeNull();
  });

  it('claims no discount when the year is not in fact cheaper', () => {
    const dear = plan({ kind: 'annual', amount: 2600 });

    expect(savingAgainstMonthly(dear, [MONTHLY, dear])).toBeNull();
  });

  it('claims no discount against a free month, which would divide by nothing', () => {
    const free = plan({ kind: 'monthly', amount: 0 });

    expect(savingAgainstMonthly(ANNUAL, [free, ANNUAL])).toBeNull();
  });
});
