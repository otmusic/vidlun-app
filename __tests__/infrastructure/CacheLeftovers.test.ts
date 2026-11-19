import { CacheLeftovers } from '@/infrastructure/files/CacheLeftovers';

/** The cache's top level on the fake disk, and what was deleted from it. */
const cache = {
  folders: [] as string[],
  files: [] as string[],
  /** What each folder holds, by name. */
  inside: {} as Record<string, string[]>,
  deleted: [] as string[],
  refusing: new Set<string>(),
  unlistable: false,
};

jest.mock('expo-file-system', () => {
  class Item {
    constructor(readonly name: string) {}

    delete(): void {
      if (cache.refusing.has(this.name)) {
        throw new Error('cannot delete');
      }

      cache.deleted.push(this.name);
    }
  }

  class File extends Item {}

  class Directory extends Item {
    list(): Item[] {
      return (cache.inside[this.name] ?? []).map((name) => new File(name));
    }
  }

  return {
    File,
    Directory,
    Paths: {
      get cache() {
        return {
          list: (): Item[] => {
            if (cache.unlistable) {
              throw new Error('cannot list');
            }

            return [
              ...cache.folders.map((name) => new Directory(name)),
              ...cache.files.map((name) => new File(name)),
            ];
          },
        };
      },
    },
  };
});

describe('CacheLeftovers', () => {
  beforeEach(() => {
    cache.folders = [];
    cache.files = [];
    cache.inside = {};
    cache.deleted = [];
    cache.refusing.clear();
    cache.unlistable = false;
  });

  // Each of these holds the whole journal, and some its voice; iOS clears the cache only when short of space.
  it('removes picked copies and the folders a backup is packed or unpacked in', async () => {
    cache.folders = ['DocumentPicker', 'backup-staging', 'backup-opened'];

    await new CacheLeftovers().sweep();

    expect(cache.deleted).toEqual(['DocumentPicker', 'backup-staging', 'backup-opened']);
  });

  it('removes backups and exports left by this version and earlier ones', async () => {
    cache.files = [
      'vidlun-backup-2026-03-02.json',
      'vidlun-backup-2026-11-18.aar',
      'vidlun-journal-2026-10-01.md',
    ];

    await new CacheLeftovers().sweep();

    expect(cache.deleted).toEqual(cache.files);
  });

  it('leaves everything else in the cache alone', async () => {
    cache.folders = ['ExpoAudio', 'RevenueCat', 'com.vidlun.journal', 'vidlun-backup-2026-11-18.aar'];
    cache.files = ['recording-1.m4a', 'vidlun-backup-latest.json', 'DocumentPicker', 'vidlun-journal-2026-10-01.txt'];

    await new CacheLeftovers().sweep();

    expect(cache.deleted).toEqual([]);
  });

  // The recorder writes every take of a launch into one file there; a kept take is moved out of it.
  it('removes takes an earlier launch left with the recorder, and keeps its folder', async () => {
    cache.folders = ['ExpoAudio'];
    cache.inside = {
      ExpoAudio: ['recording-2578FB46-E351-4D5C-A2C9-7395A1E701E8.wav', 'notes.txt'],
    };

    await new CacheLeftovers().sweep();

    expect(cache.deleted).toEqual(['recording-2578FB46-E351-4D5C-A2C9-7395A1E701E8.wav']);
  });

  it('keeps going past one it cannot remove', async () => {
    cache.folders = ['DocumentPicker'];
    cache.files = ['vidlun-backup-2026-11-18.aar'];
    cache.refusing.add('DocumentPicker');

    await expect(new CacheLeftovers().sweep()).resolves.toBeUndefined();
    expect(cache.deleted).toEqual(['vidlun-backup-2026-11-18.aar']);
  });

  it('lets the app open when the cache cannot be read', async () => {
    cache.unlistable = true;

    await expect(new CacheLeftovers().sweep()).resolves.toBeUndefined();
  });
});
