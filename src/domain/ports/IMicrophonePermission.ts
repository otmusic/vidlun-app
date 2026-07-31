export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Separate from `IAudioRecorder`: onboarding asks about the microphone long
 * before anything records, and the two change for different reasons.
 */
export interface IMicrophonePermission {
  status(): Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;
}
