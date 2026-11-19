import type { VoiceMark } from '@/domain/value-objects/VoiceCue';
import { createTranslator } from '@/i18n';
import { voiceLine } from '@/presentation/screens/voiceLine';

const uk = createTranslator('uk');
const en = createTranslator('en');

function compared(...marks: VoiceMark[]) {
  return { kind: 'compared' as const, cue: { marks } };
}

describe('the voice line under an entry\'s player', () => {
  it('names the voice, in its own words, against the usual one', () => {
    expect(voiceLine(compared('quieter', 'slower'), en)).toBe('Your voice is quieter and slower than usual');
    expect(voiceLine(compared('quieter', 'slower'), uk)).toBe(
      uk('voice.traits', { traits: `${uk('voice.quieter')}${uk('voice.and')}${uk('voice.slower')}` }),
    );
  });

  it('lists three or more with commas and a final "and"', () => {
    expect(voiceLine(compared('quieter', 'flatter', 'slower'), en)).toBe(
      'Your voice is quieter, flatter and slower than usual',
    );
  });

  it('adds the pauses as a clause of their own', () => {
    expect(voiceLine(compared('faster', 'fewer pauses'), en)).toBe(
      'Your voice is faster than usual, with fewer pauses',
    );
    expect(voiceLine(compared('more pauses'), en)).toBe('More pauses than usual');
    expect(voiceLine(compared('more pauses'), uk)).toBe(uk('voice.morePausesOnly'));
  });

  it('says so when the voice sounded as it usually does', () => {
    expect(voiceLine(compared(), en)).toBe('Your voice sounds the way it usually does');
    expect(voiceLine(compared(), uk)).toBe(uk('voice.asUsual'));
  });

  it('says it is too early while it is learning, and nothing when there is nothing to say', () => {
    expect(voiceLine({ kind: 'learning' }, en)).toBe('Not enough entries yet to compare with your usual voice');
    expect(voiceLine({ kind: 'silent' }, en)).toBeNull();
    expect(voiceLine(null, en)).toBeNull();
  });
});
