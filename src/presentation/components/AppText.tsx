import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Palette, Typography } from '../theme/tokens';

export interface AppTextProps {
  readonly variant?: keyof Typography;
  readonly color?: keyof Palette;
  readonly align?: 'left' | 'center';
  readonly numberOfLines?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly children: React.ReactNode;
}

export function AppText(props: AppTextProps): React.JSX.Element {
  const theme = useTheme();
  const variant = props.variant ?? 'body';

  return (
    <Text
      numberOfLines={props.numberOfLines}
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
