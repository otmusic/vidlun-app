import * as LocalAuthentication from 'expo-local-authentication';

import type {
  IScreenLock,
  LockMethod,
  LockReadiness,
  UnlockPrompt,
} from '../../domain/ports/IScreenLock';

export class BiometricScreenLock implements IScreenLock {
  async readiness(): Promise<LockReadiness> {
    const [types, level] = await Promise.all([
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);

    return {
      method: methodOf(types),
      ready: level !== LocalAuthentication.SecurityLevel.NONE,
    };
  }

  async unlock(prompt: UnlockPrompt): Promise<boolean> {
    const outcome = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt.reason,
      // Named here: left to the system they came out in English on a
      // Ukrainian phone, the bundle declaring no languages of its own.
      cancelLabel: prompt.cancel,
      fallbackLabel: prompt.fallback,
      // The passcode stays allowed: a winter glove or a bandage must not
      // lock someone out of their own journal.
      disableDeviceFallback: false,
    });

    return outcome.success;
  }
}

function methodOf(types: readonly LocalAuthentication.AuthenticationType[]): LockMethod {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }

  return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'touch' : 'passcode';
}
