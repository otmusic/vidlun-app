import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import type { IFilePicker } from '../../domain/ports/IFilePicker';

/**
 * The system document picker, reading whatever single file the person chose.
 * The type filter is a courtesy, not a wall: iOS greys out what it can, and
 * the codec behind this refuses anything that is not a Vidlun export anyway.
 */
export class DocumentFilePicker implements IFilePicker {
  async pickText(): Promise<string | null> {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });

    const asset = picked.assets?.[0];

    if (picked.canceled || asset === undefined) {
      return null;
    }

    return new File(asset.uri).text();
  }
}
