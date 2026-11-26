import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * What stands over the journal right now. A sheet is a native Modal, drawn
 * above every view of the app, the privacy curtain and the lock door
 * included: with the filter open, the app switcher showed the person's most
 * used feelings and topics unblurred, and a sheet left open stayed readable
 * and usable over the door after the journal shut again (security review,
 * 2026-11-26). Sheets read this to step aside.
 */
export interface Cover {
  /** The app is not in front: the switcher is photographing it. */
  readonly away: boolean;
  /** The lock door is up. */
  readonly shut: boolean;
}

export const CoverContext = createContext<Cover>({ away: false, shut: false });

export function useCover(): Cover {
  return useContext(CoverContext);
}

/** Whether the app is anywhere but in front, kept current. */
export function useAway(): boolean {
  const [away, setAway] = useState(AppState.currentState !== 'active');

  useEffect(() => {
    const watch = AppState.addEventListener('change', (state) => {
      setAway(state !== 'active');
    });

    return () => {
      watch.remove();
    };
  }, []);

  return away;
}
