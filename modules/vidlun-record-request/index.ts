import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeRecordRequest {
  take(): boolean;
  addListener(event: 'request', listener: () => void): { remove(): void };
}

/*
 * Optional on purpose: the module exists only where it was built in — on the
 * phone. In tests and on Android for now it is absent, and absence reads as
 * "nobody asked", which is the right answer there too.
 */
const native = requireOptionalNativeModule<NativeRecordRequest>('VidlunRecordRequest');

/**
 * Whether Siri, the Shortcuts app or the Control Center button asked for a
 * take since this was last called. Taking the request clears it.
 */
export function takeRecordRequest(): boolean {
  return native?.take() ?? false;
}

/** Called when such a request arrives while the app is already open. */
export function onRecordRequest(listener: () => void): () => void {
  const listening = native?.addListener('request', listener);

  return () => {
    listening?.remove();
  };
}
