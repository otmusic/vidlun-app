import { inUkraine } from '@/infrastructure/settings/inUkraine';

describe('whether the phone is most likely in Ukraine', () => {
  it('takes a phone set to the Ukrainian region, wherever its clock is', () => {
    expect(inUkraine('UA', 'Europe/Warsaw')).toBe(true);
  });

  it('takes a phone on Kyiv time, whatever its region', () => {
    expect(inUkraine('PL', 'Europe/Kyiv')).toBe(true);
  });

  it('knows Kyiv time by the names older phones still report', () => {
    for (const zone of ['Europe/Kiev', 'Europe/Uzhgorod', 'Europe/Zaporozhye']) {
      expect(inUkraine(null, zone)).toBe(true);
    }
  });

  it('leaves out a phone with neither', () => {
    expect(inUkraine('PL', 'Europe/Warsaw')).toBe(false);
    expect(inUkraine(null, null)).toBe(false);
  });
});
