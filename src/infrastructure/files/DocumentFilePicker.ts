import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from '../../domain/ports/IBackupArchive';
import type { IFilePicker } from '../../domain/ports/IFilePicker';
import { removeFromCache } from './cache';

/**
 * The system document picker, for whatever single file the person chose.
 * Any type is offered: a backup is a ZIP now, an Apple Archive in 1.10 and
 * 1.11 and a plain JSON file before, and the archive behind this refuses
 * anything that is none of them.
 *
 * The chosen file is copied into the app's cache, so it can be read the way
 * any of the app's own files is. The copy is this picker's to remove.
 */
export class DocumentFilePicker implements IFilePicker {
  async pickFile(): Promise<PickedFile | null> {
    const picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    const asset = picked.assets?.[0];

    if (picked.canceled || asset === undefined) {
      return null;
    }

    return { uri: asset.uri, name: asset.name };
  }

  discard(file: PickedFile): Promise<void> {
    removeFromCache(file.uri);

    return Promise.resolve();
  }
}
