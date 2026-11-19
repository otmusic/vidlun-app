import { createTranslator } from '@/i18n';
import { backupWhen } from '@/presentation/screens/backupWhen';

const uk = createTranslator('uk');
const en = createTranslator('en');
const NOW = new Date(2026, 10, 19, 20, 30);

describe('the day of the last backup', () => {
  it('says today for a backup made earlier today', () => {
    expect(backupWhen(new Date(2026, 10, 19, 0, 5), NOW, 'uk', uk)).toBe(uk('profile.backupToday'));
    expect(backupWhen(new Date(2026, 10, 19, 0, 5), NOW, 'en', en)).toBe('today');
  });

  it('says yesterday for the day before, across a month too', () => {
    expect(backupWhen(new Date(2026, 10, 18, 23, 59), NOW, 'en', en)).toBe('yesterday');
    expect(backupWhen(new Date(2026, 9, 31, 12, 0), new Date(2026, 10, 1, 9, 0), 'uk', uk)).toBe(
      uk('profile.backupYesterday'),
    );
  });

  it('gives the day and month within this year, with no year', () => {
    const at = new Date(2026, 10, 12, 9, 0);

    expect(backupWhen(at, NOW, 'uk', uk)).toBe(at.toLocaleDateString('uk', { day: 'numeric', month: 'long' }));
    expect(backupWhen(at, NOW, 'en', en)).toBe(at.toLocaleDateString('en', { day: 'numeric', month: 'long' }));
  });

  it('adds the year only when it is not this one, without a second stop in Ukrainian', () => {
    const at = new Date(2025, 11, 30, 9, 0);
    const ukDay = at.toLocaleDateString('uk', { day: 'numeric', month: 'long' });

    expect(backupWhen(at, NOW, 'uk', uk)).toBe(`${ukDay} 2025`);
    expect(backupWhen(at, NOW, 'en', en)).toBe(
      at.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' }),
    );
  });

  it('fits the line it goes into', () => {
    expect(en('profile.backupLast', { when: backupWhen(NOW, NOW, 'en', en) })).toBe('Last backup: today.');
  });
});
