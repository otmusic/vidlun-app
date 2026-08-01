import type { IMicrophonePermission, PermissionStatus } from '../../domain/ports/IMicrophonePermission';

/** The shape expo-audio returns from its permission calls. */
export interface NativePermissionResponse {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

export interface NativePermissionApi {
  getRecordingPermissionsAsync(): Promise<NativePermissionResponse>;
  requestRecordingPermissionsAsync(): Promise<NativePermissionResponse>;
}

export class ExpoMicrophonePermission implements IMicrophonePermission {
  constructor(private readonly api: NativePermissionApi) {}

  async status(): Promise<PermissionStatus> {
    return toStatus(await this.api.getRecordingPermissionsAsync());
  }

  async request(): Promise<PermissionStatus> {
    return toStatus(await this.api.requestRecordingPermissionsAsync());
  }
}

function toStatus(response: NativePermissionResponse): PermissionStatus {
  if (response.granted) {
    return 'granted';
  }

  // Still askable means the user has not turned us down yet, which onboarding
  // treats very differently from a refusal.
  return response.canAskAgain ? 'undetermined' : 'denied';
}
