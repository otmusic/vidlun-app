import { ENVELOPE_NAME, readEnvelope, writeEnvelope } from '@/infrastructure/files/backupEnvelope';
import { UnreadableExportError } from '@/infrastructure/persistence/JournalCodec';

const JOURNAL = JSON.stringify({ app: 'vidlun', format: 1, exportedAt: '2026-11-23T10:00:00.000Z', entries: [] });

describe('the hidden file a backup restores from', () => {
  it('is hidden from Files and Finder by its name', () => {
    expect(ENVELOPE_NAME.startsWith('.')).toBe(true);
  });

  it('carries the journal unchanged and where each voice sits', () => {
    const text = writeEnvelope(JOURNAL, new Map([['entry-1', 'audio/2026-11-18 21-10.m4a']]));

    expect(readEnvelope(text)).toEqual({
      json: JOURNAL,
      voices: [{ entryId: 'entry-1', path: 'audio/2026-11-18 21-10.m4a' }],
    });
  });

  it('reads a journal with no voices', () => {
    expect(readEnvelope(writeEnvelope(JOURNAL, new Map()))).toEqual({ json: JOURNAL, voices: [] });
  });

  it('leaves text that is not one to the codec, such as a backup from before 1.10', () => {
    expect(readEnvelope(JOURNAL)).toBeNull();
    expect(readEnvelope('not json at all')).toBeNull();
    expect(readEnvelope('[1, 2]')).toBeNull();
  });

  it('refuses one made by a newer version rather than guessing at it', () => {
    const newer = JSON.stringify({ kind: 'vidlun-backup', version: 99, journal: {}, voices: {} });

    expect(() => readEnvelope(newer)).toThrow(UnreadableExportError);
  });

  // A recording is filed under its entry's id: neither the id nor the path may lead out of the backup.
  it('drops a voice whose path or entry id could reach outside the backup', () => {
    const text = JSON.stringify({
      kind: 'vidlun-backup',
      version: 1,
      journal: {},
      voices: {
        kept: 'audio/kept.m4a',
        climbing: '../outside.m4a',
        rooted: '/etc/hosts',
        hidden: 'audio/../../x.m4a',
        '../escape': 'audio/fine.m4a',
        empty: '',
        number: 3,
      },
    });

    expect(readEnvelope(text)?.voices).toEqual([{ entryId: 'kept', path: 'audio/kept.m4a' }]);
  });
});
