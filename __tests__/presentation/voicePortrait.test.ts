import { createTranslator } from '@/i18n';
import { measureNameKey, placeOnScale, scaleWordKey, usualBand } from '@/presentation/screens/voicePortrait';

const en = createTranslator('en');

describe('a row of the voice portrait', () => {
  it('puts the usual middle in the middle, less to the left and more to the right', () => {
    expect(placeOnScale(0)).toBe(50);
    expect(placeOnScale(-1.5)).toBeLessThan(50);
    expect(placeOnScale(1.5)).toBeGreaterThan(50);
  });

  it('keeps a far take on its line', () => {
    expect(placeOnScale(-40)).toBe(4);
    expect(placeOnScale(40)).toBe(96);
  });

  it('draws the usual band as wide as what still counts as usual', () => {
    expect(usualBand(1).from).toBeCloseTo(50 - 50 / 3);
    expect(usualBand(1).to).toBeCloseTo(50 + 50 / 3);
    // Loudness is given more room, so its band is wider.
    expect(usualBand(1.5).to - usualBand(1.5).from).toBeGreaterThan(usualBand(1).to - usualBand(1).from);
  });

  it('a marked take sits outside its band, an unmarked one inside', () => {
    const band = usualBand(1);

    expect(placeOnScale(-1.2)).toBeLessThan(band.from);
    expect(placeOnScale(0.6)).toBeLessThan(band.to);
    expect(placeOnScale(0.6)).toBeGreaterThan(band.from);
  });

  it('names the measure and says how the take differed, in a word', () => {
    expect(en(measureNameKey('pace'))).toBe('Pace');
    expect(en(scaleWordKey({ measure: 'pace', away: -2, usualWithin: 1, mark: 'slower' }))).toBe('slower');
    expect(en(scaleWordKey({ measure: 'pauses', away: 2, usualWithin: 1, mark: 'more pauses' }))).toBe('more');
    expect(en(scaleWordKey({ measure: 'pitch', away: 0.2, usualWithin: 1, mark: null }))).toBe('as usual');
  });
});
