import * as Haptics from 'expo-haptics';

import type { IHaptics } from '../../domain/ports/IHaptics';

/**
 * Haptics are a courtesy, never a requirement: a device without a taptic engine
 * rejects these promises, and a dropped buzz must not surface as a failed entry.
 */
export class ExpoHaptics implements IHaptics {
  tap(): void {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  }

  settle(): void {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
  }

  success(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  }
}

function ignore(): void {
  // Intentionally silent; see the class comment.
}
