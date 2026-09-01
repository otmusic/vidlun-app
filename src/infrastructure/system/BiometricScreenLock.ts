import * as LocalAuthentication from 'expo-local-authentication';

import type { IScreenLock } from '../../domain/ports/IScreenLock';

export class BiometricScreenLock implements IScreenLock {
  async available(): Promise<boolean> {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  }

  async unlock(reason: string): Promise<boolean> {
    const outcome = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // The passcode stays allowed: a winter glove or a bandage must not
      // lock someone out of their own journal.
      disableDeviceFallback: false,
    });

    return outcome.success;
  }
}
