import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

import type { IFileSharer } from '../../domain/ports/IFileSharer';

/**
 * Writes into the cache — the system copies what the person chose to keep,
 * and iOS may clear the rest whenever it likes, which is the right lifetime
 * for a file that only exists to be handed over.
 */
export class ShareSheetFileSharer implements IFileSharer {
  async share(filename: string, contents: string): Promise<boolean> {
    const file = new File(Paths.cache, filename);

    if (file.exists) {
      file.delete();
    }

    file.write(contents);

    const outcome = await Share.share({ url: file.uri });

    return outcome.action === Share.sharedAction;
  }
}
