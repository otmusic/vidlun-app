import { useEffect, useState } from 'react';

/**
 * True once `delayMs` have passed with `active` true, false again the
 * moment it is not. For the line that only appears when a wait has gone on
 * longer than it should: shown at once it would make every wait look slow.
 */
export function useAfter(delayMs: number, active = true): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (!active) {
      setPassed(false);

      return undefined;
    }

    const timer = setTimeout(() => {
      setPassed(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [active, delayMs]);

  return passed;
}
