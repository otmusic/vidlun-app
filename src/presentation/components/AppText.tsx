import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { typeScaleCap, type Palette, type Typography } from '../theme/tokens';

export interface AppTextProps {
  readonly variant?: keyof Typography;
  readonly color?: keyof Palette;
  readonly align?: 'left' | 'center';
  readonly numberOfLines?: number;
  /** Overrides the style's own Dynamic Type cap where a component is tighter still. */
  readonly maxScale?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly children: React.ReactNode;
}

export function AppText(props: AppTextProps): React.JSX.Element {
  const theme = useTheme();
  const variant = props.variant ?? 'body';

  return (
    <Text
      numberOfLines={props.numberOfLines}
      maxFontSizeMultiplier={props.maxScale ?? typeScaleCap[variant]}
      style={[
        theme.type[variant],
        { color: theme.palette[props.color ?? 'ink'], textAlign: props.align ?? 'left' },
        props.style,
      ]}
    >
      {props.children}
    </Text>
  );
}
