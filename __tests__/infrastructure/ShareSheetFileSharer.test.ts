import { ShareSheetFileSharer } from '@/infrastructure/files/ShareSheetFileSharer';

const CACHE = 'file:///app/Library/Caches/';
const BACKUP = `${CACHE}vidlun-backup-2026-11-18.aar`;

/** The files on the fake disk, what was deleted, and what the sheet saw. */
const disk = {
  present: new Map<string, string>(),
  deleted: [] as string[],
  /** Whether each shared file was still there when the sheet opened. */
  sharedWhilePresent: [] as boolean[],
  sheet: 'sharedAction' as 'sharedAction' | 'dismissedAction' | 'fails',
};

jest.mock('react-native', () => ({
  Share: {
    sharedAction: 'sharedAction',
    share: jest.fn(({ url }: { url: string }) => {
      disk.sharedWhilePresent.push(disk.present.has(url));

      return disk.sheet === 'fails'
        ? Promise.reject(new Error('no sheet'))
        : Promise.resolve({ action: disk.sheet });
    }),
  },
}));

jest.mock('expo-file-system', () => ({
  Paths: {
    get cache() {
      return { uri: CACHE };
    },
  },
  File: class {
    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('');
    }

    get exists(): boolean {
      return disk.present.has(this.uri);
    }

    write(contents: string): void {
      disk.present.set(this.uri, contents);
    }

    delete(): void {
      disk.present.delete(this.uri);
      disk.deleted.push(this.uri);
    }
  },
}));

describe('ShareSheetFileSharer', () => {
  beforeEach(() => {
    disk.present.clear();
    disk.deleted = [];
    disk.sharedWhilePresent = [];
    disk.sheet = 'sharedAction';
  });

  // The backup holds the whole journal and its voice; once handed over, the app keeps no copy.
  it('removes a backup once the sheet has handed it over', async () => {
    disk.present.set(BACKUP, 'archive');

    const shared = await new ShareSheetFileSharer().shareFile(BACKUP);

    expect(shared).toBe(true);
    expect(disk.sharedWhilePresent).toEqual([true]);
    expect(disk.deleted).toEqual([BACKUP]);
  });

  it('removes it as well when the person closes the sheet without sharing', async () => {
    disk.present.set(BACKUP, 'archive');
    disk.sheet = 'dismissedAction';

    const shared = await new ShareSheetFileSharer().shareFile(BACKUP);

    expect(shared).toBe(false);
    expect(disk.deleted).toEqual([BACKUP]);
  });

  it('removes it when the sheet cannot open', async () => {
    disk.present.set(BACKUP, 'archive');
    disk.sheet = 'fails';

    await expect(new ShareSheetFileSharer().shareFile(BACKUP)).rejects.toThrow('no sheet');
    expect(disk.deleted).toEqual([BACKUP]);
  });

  it('never deletes a shared file outside the app cache', async () => {
    const recording = 'file:///app/Documents/recordings/entry-1.m4a';
    disk.present.set(recording, 'audio');

    await new ShareSheetFileSharer().shareFile(recording);

    expect(disk.deleted).toEqual([]);
  });

  it('writes the Markdown export, hands it over, then removes it', async () => {
    const shared = await new ShareSheetFileSharer().share('vidlun-journal-2026-11-18.md', '# Journal');

    expect(shared).toBe(true);
    expect(disk.sharedWhilePresent).toEqual([true]);
    expect(disk.deleted).toEqual([`${CACHE}vidlun-journal-2026-11-18.md`]);
    expect(disk.present.size).toBe(0);
  });
});
