import { requireOptionalNativeModule } from 'expo-modules-core';

/** The native half of keeping the voice small and backing it up; see `ios/BackupModule.swift`. */
export interface NativeBackup {
  compressAudio(source: string, target: string): Promise<void>;
  pack(source: string, target: string): Promise<void>;
  unpack(source: string, target: string): Promise<void>;
  /** The folder at `source`, itself at the root, as a ZIP at `target`: the backup since 2026-11-23. */
  zip(source: string, target: string): Promise<void>;
  /** The ZIP at `source` unpacked into the folder at `target`; refuses a name that would leave it. */
  unzip(source: string, target: string): Promise<void>;
  /** Every file the app wrote, moved to the protection class new files get; resolves with how many moved. */
  protectAppData(): Promise<number>;
}

/*
 * Optional on purpose, like the voice module: absent in tests, on Android for
 * now, and in a build made before it — and then the backup is the journal's
 * text alone, as it always was.
 */
export const nativeBackup = requireOptionalNativeModule<NativeBackup>('VidlunBackup');
