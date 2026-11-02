import { topicsSection } from '@/presentation/screens/weekTopics';

const WORK = { tag: 'work', entryCount: 3 };

describe('the topics section of the week', () => {
  it('shows the topics to someone with a subscription', () => {
    expect(topicsSection({ hasNarrativeAccess: true, themes: [WORK] })).toBe('open');
  });

  it('shows the lock over topics the week has, to someone without one', () => {
    expect(topicsSection({ hasNarrativeAccess: false, themes: [WORK] })).toBe('locked');
  });

  /*
   * The lock promised topics the week did not have: whoever paid to open it
   * found the section gone (2026-10-30). No topics, no section, for anyone.
   */
  it('shows nothing when the week has no topics, locked or not', () => {
    expect(topicsSection({ hasNarrativeAccess: false, themes: [] })).toBeNull();
    expect(topicsSection({ hasNarrativeAccess: true, themes: [] })).toBeNull();
  });
});
