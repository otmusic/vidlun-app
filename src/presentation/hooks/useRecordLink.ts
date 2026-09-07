import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { isRecordLink } from '../recordLink';

/**
 * "Record in Vidlun" from outside the app arrives as a URL, cold or while
 * the app is open, and starts a take the moment the journal is ready for
 * one — not over onboarding, not behind the lock, not in the middle of a
 * card. A link that came too early waits rather than being dropped.
 */
export function useRecordLink(input: { readonly ready: boolean; readonly onRecord: () => void }): void {
  const { ready, onRecord } = input;
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const note = (url: string | null): void => {
      if (isRecordLink(url)) {
        setPending(true);
      }
    };

    void Linking.getInitialURL().then(note);

    const listening = Linking.addEventListener('url', ({ url }) => {
      note(url);
    });

    return () => {
      listening.remove();
    };
  }, []);

  useEffect(() => {
    if (pending && ready) {
      setPending(false);
      onRecord();
    }
  }, [onRecord, pending, ready]);
}
