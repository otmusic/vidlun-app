import { useEffect } from 'react';
import { View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Screen } from './Screen';

/** How long "Saved" stays: a beat to be seen, not a screen to be left. */
const SHOWN_FOR_MS = 1_000;

/**
 * One word, centred, gone by itself: saving is not an event that needs a
 * button to get past. The owner asked for exactly this on the first day on
 * sale. The grounding offer after an entry that sounded overwhelmed used to
 * sit under the word; it follows on a page of its own now (owner's word,
 * 2026-10-06), so this screen always leaves after its beat.
 */
export function SavedScreen(props: {
  readonly t: Translate;
  /** Where the beat ends: home, or the grounding offer after a hard entry. */
  readonly onDone: () => void;
}): React.JSX.Element {
  const { onDone } = props;

  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_FOR_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="display">{props.t('saved.title')}</AppText>
      </View>
    </Screen>
  );
}
