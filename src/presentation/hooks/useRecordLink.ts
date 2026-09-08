import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { onRecordRequest, takeRecordRequest } from '../../../modules/vidlun-record-request';
import { isRecordLink } from '../recordLink';

/**
 * "Record in Vidlun" from outside the app, cold or while the app is open,
 * starts a take the moment the journal is ready for one — not over
 * onboarding, not behind the lock, not in the middle of a card. A request
 * that came too early waits rather than being dropped.
 *
 * Two carriers. A widget tap is a URL the system launches the app with, or
 * hands to the open app. Siri, the Shortcuts app and the Control Center
 * button run the intent inside the app and leave a request behind, because
 * a URL handed over in the seconds after launch arrives before anything
 * here is listening.
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

    if (takeRecordRequest()) {
      setPending(true);
    }

    const listening = Linking.addEventListener('url', ({ url }) => {
      note(url);
    });

    const asked = onRecordRequest(() => {
      if (takeRecordRequest()) {
        setPending(true);
      }
    });

    return () => {
      listening.remove();
      asked();
    };
  }, []);

  useEffect(() => {
    if (pending && ready) {
      setPending(false);
      onRecord();
    }
  }, [onRecord, pending, ready]);
}
