import type { IKeyValueStore } from '../persistence/IKeyValueStore';

/** The native pass that moves the app's existing files to the protected class. */
export interface ProtectAppData {
  protectAppData(): Promise<number>;
}

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const PROTECTED = 'vidlun.dataProtection';

/** Bumped when the class or the folders it covers change, so the pass runs again. */
const VERSION = '1';

/**
 * Once per install, and again if the version moves: the files written before
 * the app asked for complete-unless-open protection kept iOS's default, and
 * nothing else would ever move them (owner's word, 2026-11-26). New files
 * come out protected on their own, so a pass that has run never has to.
 */
export async function protectAppDataOnce(native: ProtectAppData | null, store: IKeyValueStore): Promise<void> {
  if (native === null || (await store.getItem(PROTECTED)) === VERSION) {
    return;
  }

  await native.protectAppData();
  await store.setItem(PROTECTED, VERSION);
}
