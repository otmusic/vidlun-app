import { Emotion } from '@/domain/entities/Emotion';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { emotionColor } from '@/presentation/theme/emotionColor';

const EMOTION_VOCABULARY = createEmotionVocabulary();

function rootOf(id: string): Emotion {
  const root = EMOTION_VOCABULARY.find(id.split('.')[0] ?? id);

  if (root === undefined) {
    throw new Error(`no root for ${id}`);
  }

  return root;
}

function colorOf(id: string, scheme: 'light' | 'dark' = 'light'): string {
  const emotion = EMOTION_VOCABULARY.find(id);

  if (emotion === undefined) {
    throw new Error(`no emotion ${id}`);
  }

  return emotionColor(emotion, rootOf(id), scheme);
}

/** Relative luminance, only precise enough to compare two colours. */
function luminance(hex: string): number {
  const channel = (at: number): number => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

describe('emotionColor', () => {
  it('gives every word in the vocabulary a colour', () => {
    for (const emotion of EMOTION_VOCABULARY.all()) {
      expect(colorOf(emotion.id)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('hands back the identity colour untouched where one exists', () => {
    expect(colorOf('fearful.anxious')).toBe('#4433E0');
    expect(colorOf('fearful.anxious', 'dark')).toBe('#8B7BFF');
  });

  it('keeps a word close to its own parent, so a branch reads together', () => {
    const tired = colorOf('bad.busy');
    const pressured = colorOf('bad.busy.pressured');

    expect(hueDistance(tired, pressured)).toBeLessThan(0.1);
  });

  it('does not flatten a branch: numb and furious are both anger and not one colour', () => {
    expect(colorOf('angry.distant.numb')).not.toBe(colorOf('angry.mad.furious'));
  });

  it('separates anger from fear, which share both axes', () => {
    const annoyed = colorOf('angry.critical.skeptical');
    const worried = colorOf('fearful.anxious.worried');

    expect(annoyed).not.toBe(worried);
    expect(hueDistance(annoyed, worried)).toBeGreaterThan(0.1);
  });

  it('leaves an ordinary state nearly colourless', () => {
    const awaiting = colorOf('compound.awaiting');

    expect(saturation(awaiting)).toBeLessThan(saturation(colorOf('angry.mad.furious')));
  });

  it('darkens a child rather than recolouring it', () => {
    const tired = colorOf('bad.busy');
    const rushed = colorOf('bad.busy.rushed');

    expect(luminance(rushed)).toBeLessThan(luminance(tired));
  });

  it('lifts every colour for the dark theme', () => {
    for (const id of ['sad.lonely.isolated', 'bad.busy', 'happy.playful']) {
      expect(luminance(colorOf(id, 'dark'))).toBeGreaterThan(luminance(colorOf(id)));
    }
  });

  it('never lands in the signalling red the mood scale forbids', () => {
    for (const emotion of EMOTION_VOCABULARY.all()) {
      const hex = colorOf(emotion.id);
      const red = parseInt(hex.slice(1, 3), 16);
      const green = parseInt(hex.slice(3, 5), 16);
      const blue = parseInt(hex.slice(5, 7), 16);
      const isAlarm = red > 200 && green < 70 && blue < 70;

      expect(isAlarm).toBe(false);
    }
  });
});

function channels(hex: string): readonly number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
}

function saturation(hex: string): number {
  const values = channels(hex);

  return Math.max(...values) - Math.min(...values);
}

/** Crude but sufficient: how far apart two colours point in RGB. */
function hueDistance(a: string, b: string): number {
  const first = channels(a);
  const second = channels(b);

  return Math.hypot(
    (first[0] ?? 0) - (second[0] ?? 0),
    (first[1] ?? 0) - (second[1] ?? 0),
    (first[2] ?? 0) - (second[2] ?? 0),
  );
}
