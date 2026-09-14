import { requireOptionalNativeModule } from 'expo-modules-core';

/** What the adapter drives; the shape a test fakes. */
export interface AppleSpeech {
  /** Whether this device can read the language by itself. */
  isAvailable(locale: string): Promise<boolean>;
  /** Brings the language's assets onto the device; idempotent and cheap once done. */
  prepare(locale: string): Promise<string>;
  transcribe(fileUri: string, locale: string): Promise<string>;
}

/*
 * Optional on purpose: the module exists only where it was built in. In
 * tests, on the web and on Android for now it is absent, and absence reads
 * as "this phone cannot read by itself", which sends the take to the model.
 */
const native = requireOptionalNativeModule<AppleSpeech>('VidlunSpeech');

export const appleSpeech: AppleSpeech | null = native;
