import { NothingWasSaidError } from '@/domain/errors/MoodEntryErrors';
import { noticeFor } from '@/presentation/hooks/useCaptureFlow';

describe('the line a failure puts on screen', () => {
  it('says the take had no words in the app’s own words, not the error’s', () => {
    expect(noticeFor(new NothingWasSaidError())).toEqual({ kind: 'silent' });
  });

  it('keeps the layer below’s message for anything else', () => {
    expect(noticeFor(new Error('model unavailable'))).toEqual({
      kind: 'failed',
      message: 'model unavailable',
    });
  });

  it('reads a native rejection that is not an Error', () => {
    expect(noticeFor({ message: 'recorder busy' })).toEqual({
      kind: 'failed',
      message: 'recorder busy',
    });
  });
});
