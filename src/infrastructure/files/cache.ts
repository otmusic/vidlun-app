import { File, Paths } from 'expo-file-system';

/**
 * Removes a file the app made in its own cache: a picked backup's copy, or a
 * backup written only to be handed over. Each holds the whole journal, and
 * iOS clears the cache only when the phone runs short of space.
 *
 * A file anywhere else is the person's own, which only they may delete, so it
 * is left alone. Never throws: a copy that will not go must not turn a
 * finished restore or share into a failed one.
 */
export function removeFromCache(uri: string): void {
  if (!inCache(uri)) {
    return;
  }

  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch {
    // Left to iOS, which clears the cache on its own.
  }
}

function inCache(uri: string): boolean {
  const cache = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;

  return uri.startsWith(cache) && !uri.slice(cache.length).split('/').includes('..');
}
