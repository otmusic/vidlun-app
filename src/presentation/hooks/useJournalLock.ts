import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { IScreenLock, LockMethod, UnlockPrompt } from '@/domain/ports/IScreenLock';

import { relocksAfter } from '../screens/lockRules';

export interface JournalLock {
  /** Whether the door is open. Always true while the lock is off. */
  readonly open: boolean;
  /** What opens the phone, for naming the lock; Face ID until the phone has said. */
  readonly method: LockMethod;
  /** Counts returns from the background, so a shut door can ask again on each. */
  readonly returns: number;
  /** Shows the system prompt once; a second ask while one is up is ignored. */
  readonly tryOpen: () => void;
  /**
   * For the switch in "Me": proves the lock works before it is promised, and
   * leaves the door open behind it. `refuse` hears why it cannot be turned on.
   */
  readonly enable: (refuse: (method: LockMethod) => void) => Promise<boolean>;
}

/**
 * The journal's door (owner's word, 2026-11-20). Shut at every launch while
 * the lock is on — the door starts closed rather than following a default
 * that has not been read yet, which is how 1.3's lock let a cold launch
 * straight in — and shut again after a minute away.
 */
export function useJournalLock(input: {
  readonly on: boolean;
  readonly lock: IScreenLock;
  /** The system prompt's words, in the app's language. */
  readonly prompt: UnlockPrompt;
  readonly now: () => number;
}): JournalLock {
  const { lock, prompt, now } = input;
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<LockMethod>('face');
  const [returns, setReturns] = useState(0);
  const asking = useRef(false);

  useEffect(() => {
    void lock.readiness().then(
      (readiness) => {
        setMethod(readiness.method);
      },
      () => undefined,
    );
  }, [lock]);

  /*
   * The decision is made on the way back in, not on the way out: asking for
   * Face ID while the app is still in the background is refused without a
   * word. Only a real return counts — the Face ID prompt itself takes the
   * app to "inactive" and back, and treating that as a return would ask
   * again the moment someone cancelled.
   */
  useEffect(() => {
    let leftAt: number | null = null;

    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt = now();

        return;
      }

      if (state === 'active' && leftAt !== null) {
        if (relocksAfter(now() - leftAt)) {
          setOpen(false);
        }

        leftAt = null;
        setReturns((count) => count + 1);
      }
    });

    return () => {
      watch.remove();
    };
  }, [now]);

  const ask = useCallback(async (): Promise<boolean> => {
    if (asking.current) {
      return false;
    }

    asking.current = true;

    try {
      const unlocked = await lock.unlock(prompt);

      if (unlocked) {
        setOpen(true);
      }

      return unlocked;
    } catch {
      return false;
    } finally {
      asking.current = false;
    }
  }, [lock, prompt]);

  const tryOpen = useCallback(() => {
    void ask();
  }, [ask]);

  const enable = useCallback(
    async (refuse: (method: LockMethod) => void): Promise<boolean> => {
      const readiness = await lock.readiness();

      setMethod(readiness.method);

      if (!readiness.ready) {
        refuse(readiness.method);

        return false;
      }

      return ask();
    },
    [ask, lock],
  );

  return { open: !input.on || open, method, returns, tryOpen, enable };
}
