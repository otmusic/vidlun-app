import { isRecordLink } from '@/presentation/recordLink';

describe('the link a widget, Siri or the Action Button opens the app with', () => {
  it('recognises the record link as the phone sends it', () => {
    expect(isRecordLink('vidlun://record')).toBe(true);
    expect(isRecordLink('vidlun://record/')).toBe(true);
    expect(isRecordLink('Vidlun://Record')).toBe(true);
  });

  it('leaves every other link alone', () => {
    expect(isRecordLink('vidlun://')).toBe(false);
    expect(isRecordLink('vidlun://record/now')).toBe(false);
    expect(isRecordLink('vidlun://recording')).toBe(false);
    expect(isRecordLink('com.vidlun.journal://record')).toBe(false);
    expect(isRecordLink('https://vidlun.app/record')).toBe(false);
  });

  it('treats a missing link as no request', () => {
    expect(isRecordLink(null)).toBe(false);
    expect(isRecordLink(undefined)).toBe(false);
    expect(isRecordLink('')).toBe(false);
  });
});
