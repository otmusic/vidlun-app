import { View } from 'react-native';

import type { VoiceScale } from '@/domain/value-objects/VoiceCue';
import type { Translate } from '@/i18n';

import { measureNameKey, placeOnScale, scaleWordKey, usualBand } from '../screens/voicePortrait';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/** The dot's size; the line it sits on is thinner, so the dot reads as the take. */
const DOT = 16;

/**
 * The voice portrait (owner's word, 2026-11-19, from variant B), folded out
 * under the line about the voice in the entry's card rather than in a sheet
 * (owner's word, 2026-11-24): one row per measure — the person's usual band
 * on a line and this take as a dot on it, with one word for how it differed.
 * No numbers anywhere; one sentence under the rows says what it is compared
 * with.
 */
export function VoicePortrait(props: {
  readonly portrait: readonly VoiceScale[];
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;

  return (
    <View style={{ gap: 18, paddingTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 22, height: 8, borderRadius: 4, backgroundColor: theme.palette.tile }} />
        <AppText variant="secondary" color="inkFaint">
          {t('voice.usualBand')}
        </AppText>
      </View>

      <View style={{ gap: 18 }}>
        {props.portrait.map((scale) => (
          <ScaleRow key={scale.measure} scale={scale} t={t} />
        ))}
      </View>

      <AppText variant="secondary" color="inkFaint">
        {t('voice.portraitNote')}
      </AppText>
    </View>
  );
}

function ScaleRow(props: { readonly scale: VoiceScale; readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();
  const { scale, t } = props;
  const band = usualBand(scale.usualWithin);
  const marked = scale.mark !== null;
  const name = t(measureNameKey(scale.measure));
  const word = t(scaleWordKey(scale));

  return (
    <View accessible accessibilityLabel={`${name}: ${word}`} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="secondary" color="inkSoft">
          {name}
        </AppText>
        <AppText variant="secondary" color={marked ? 'accentInk' : 'inkFaint'}>
          {word}
        </AppText>
      </View>
      <View style={{ height: DOT, justifyContent: 'center' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.palette.range }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${band.from}%`,
              width: `${band.to - band.from}%`,
              borderRadius: 4,
              backgroundColor: theme.palette.tile,
            }}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            left: `${placeOnScale(scale.away)}%`,
            marginLeft: -DOT / 2,
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            borderWidth: 2,
            borderColor: theme.palette.paper,
            backgroundColor: marked ? theme.palette.accent : theme.palette.inkFaint,
          }}
        />
      </View>
    </View>
  );
}
