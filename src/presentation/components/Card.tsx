import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  readonly tone?: 'paper' | 'accent' | 'quiet' | 'panel';
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

/**
 * Depth comes from lifting the surface, not from shadows, and never from
 * translucency: these carry text about feelings, and glass over a busy
 * background destroys both hierarchy and readability.
 */
export function Card(props: CardProps): React.JSX.Element {
  const theme = useTheme();
  const tone = props.tone ?? 'paper';

  const background =
    tone === 'accent'
      ? theme.palette.accentSoft
      : tone === 'quiet'
        ? theme.palette.lineSoft
        : tone === 'panel'
          ? theme.palette.panel
          : theme.palette.paper;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          // The panel is the loudest surface in the language, so it is also the
          // roundest: it reads as a block set into the page rather than a card
          // lying on it.
          borderRadius: tone === 'panel' ? 26 : theme.radii.card,
          paddingVertical: 18,
          paddingHorizontal: tone === 'panel' ? 24 : 20,
          gap: theme.spacing.sm,
          borderWidth: tone === 'paper' ? 1 : 0,
          borderColor: theme.palette.line,
        },
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}
