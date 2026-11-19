import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

import type { IFileSharer } from '../../domain/ports/IFileSharer';
import { removeFromCache } from './cache';

/**
 * Writes into the cache, the right place for a file that only exists to be
 * handed over, and removes it once the sheet is done with it.
 *
 * iOS reports back only after the chosen app has finished with the file, or
 * the sheet was closed, so nothing is taken from under a share in progress.
 * Android's sheet reports back as it opens; a sharer there will need its own
 * moment to clean up.
 */
export class ShareSheetFileSharer implements IFileSharer {
  async share(filename: string, contents: string): Promise<boolean> {
    const file = new File(Paths.cache, filename);

    if (file.exists) {
      file.delete();
    }

    file.write(contents);

    return this.shareFile(file.uri);
  }

  async shareFile(uri: string): Promise<boolean> {
    try {
      const outcome = await Share.share({ url: uri });

      return outcome.action === Share.sharedAction;
    } finally {
      removeFromCache(uri);
    }
  }
}
