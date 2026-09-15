import { audioNoteKey } from '@/presentation/screens/audioNote';

describe('the line where the player would be', () => {
  it('says a typed entry never had audio, whatever the switch says', () => {
    expect(audioNoteKey('text', true)).toBe('detail.audioTyped');
    expect(audioNoteKey('text', false)).toBe('detail.audioTyped');
  });

  it('blames the switch only while the switch is off', () => {
    expect(audioNoteKey('voice', false)).toBe('detail.audioGone');
  });

  it('claims nothing about settings for a voice that is gone while the switch is on', () => {
    expect(audioNoteKey('voice', true)).toBe('detail.audioMissing');
  });
});
