import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/**
 * A count of what the person has done: the run of days on home, the entries
 * in the journal (owner's word, 2026-10-01). The only places a number is
 * allowed to look like an achievement, and still a quiet fill rather than the
 * accent: the accent means "Vidlun is speaking", and these are the person's
 * own doing.
 */
export function CountPill(props: { readonly value: number; readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: theme.palette.limeSoft,
        borderRadius: theme.radii.pill,
        paddingVertical: 6,
        paddingLeft: 10,
        paddingRight: 12,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.palette.accent }} />
      {/* The pill shares a row with a heading; past 1.2 the two no longer fit side by side. */}
      <AppText variant="numeric" maxScale={1.2} style={{ fontSize: 14 }}>
        {String(props.value)}
      </AppText>
      <AppText variant="secondary" color="inkSoft" maxScale={1.2} style={{ fontSize: 12 }}>
        {props.label}
      </AppText>
    </View>
  );
}
