import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  readonly tone?: 'paper' | 'accent' | 'quiet';
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
        : theme.palette.paper;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: theme.radii.card,
          padding: theme.spacing.md,
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
