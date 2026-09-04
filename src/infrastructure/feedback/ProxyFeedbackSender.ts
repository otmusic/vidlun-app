import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { IFeedbackSender } from '../../domain/ports/IFeedbackSender';
import { FeedbackUndeliveredError } from '../../domain/errors/FeedbackErrors';

/**
 * Hands the note to the proxy, which mails it on. The same attested fetch as
 * every other call: the proxy accepts feedback only from a genuine build, so
 * the support inbox cannot be flooded from a script.
 *
 * The build number rides along because "which version" is the first thing
 * support asks and the last thing a person remembers.
 */
export class ProxyFeedbackSender implements IFeedbackSender {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchWithProof: typeof fetch,
  ) {}

  async send(text: string): Promise<void> {
    const config = Constants.expoConfig;
    const response = await this.fetchWithProof(`${this.baseUrl}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        app: {
          version: config?.version ?? 'unknown',
          build: config?.ios?.buildNumber ?? 'unknown',
          platform: `${Platform.OS} ${String(Platform.Version)}`,
        },
      }),
    });

    if (!response.ok) {
      throw new FeedbackUndeliveredError(response.status);
    }
  }
}
