import { DocumentFilePicker } from '@/infrastructure/files/DocumentFilePicker';

const CACHE = 'file:///app/Library/Caches/';
const COPY = `${CACHE}DocumentPicker/0F3A.aar`;

/** The files on the fake disk, and the ones deleted from it. */
const disk = {
  present: new Set<string>(),
  deleted: [] as string[],
  refusing: false,
};

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

jest.mock('expo-file-system', () => ({
  Paths: {
    get cache() {
      return { uri: CACHE };
    },
  },
  File: class {
    constructor(readonly uri: string) {}

    get exists(): boolean {
      return disk.present.has(this.uri);
    }

    delete(): void {
      if (disk.refusing) {
        throw new Error('cannot delete');
      }

      disk.present.delete(this.uri);
      disk.deleted.push(this.uri);
    }
  },
}));

function picked(uri: string) {
  return { uri, name: 'vidlun-backup-2026-11-18.aar' };
}

describe('DocumentFilePicker.discard', () => {
  beforeEach(() => {
    disk.present.clear();
    disk.deleted = [];
    disk.refusing = false;
  });

  it('removes the copy it made in the cache', async () => {
    disk.present.add(COPY);

    await new DocumentFilePicker().discard(picked(COPY));

    expect(disk.deleted).toEqual([COPY]);
  });

  it('never deletes a file outside the app cache', async () => {
    const elsewhere = [
      'file:///app/Documents/recordings/entry-1.m4a',
      'file:///app/Library/CachesElsewhere/backup.aar',
      `${CACHE}../../Documents/journal.json`,
      'content://com.android.providers.downloads/document/12',
    ];

    for (const uri of elsewhere) {
      disk.present.add(uri);
      await new DocumentFilePicker().discard(picked(uri));
    }

    expect(disk.deleted).toEqual([]);
  });

  it('lets a copy that is already gone go quietly', async () => {
    await expect(new DocumentFilePicker().discard(picked(COPY))).resolves.toBeUndefined();
    expect(disk.deleted).toEqual([]);
  });

  it('does not fail when the copy cannot be removed', async () => {
    disk.present.add(COPY);
    disk.refusing = true;

    await expect(new DocumentFilePicker().discard(picked(COPY))).resolves.toBeUndefined();
  });
});
