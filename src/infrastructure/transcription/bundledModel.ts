import { File, Paths } from 'expo-file-system';

import { SPEECH_MODEL } from './speechModel';

/**
 * Where the model the app ships with lives, or null in a build made without
 * it. The plugin that bundles the file refuses to build without it, so null
 * is a development build that skipped `scripts/fetch-model.sh` — and such a
 * build is a typed journal rather than a broken voice one.
 */
export function bundledModelUri(): string | null {
  const file = new File(Paths.bundle, SPEECH_MODEL.fileName);

  return file.exists ? file.uri : null;
}
