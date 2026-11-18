import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from '../../domain/ports/IBackupArchive';
import type { IFilePicker } from '../../domain/ports/IFilePicker';

/**
 * The system document picker, for whatever single file the person chose.
 * Any type is offered: a backup is an archive now and a plain JSON file
 * before 1.10, and the archive behind this refuses anything that is neither.
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
}
