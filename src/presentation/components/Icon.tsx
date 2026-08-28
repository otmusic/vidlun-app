import Feather from '@expo/vector-icons/Feather';

import { useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/tokens';

/**
 * §7.4 asks for thin icons in a muted colour, never louder than the text they
 * sit beside. Feather is the thin family in the set Expo ships, and going
 * through one component keeps the weight and the palette in one place rather
 * than as a size prop guessed per screen.
 */
export type IconName =
  | 'settings'
  | 'trash-2'
  | 'edit-3'
  | 'check'
  | 'x'
  | 'mic'
  | 'square'
  | 'arrow-left'
  | 'eye-off';

/** §7.4: 16–20 inline, 24 at most. Anything larger is a glyph, not an icon. */
export const ICON_SIZE = { inline: 18, action: 22, glyph: 24 } as const;

export function Icon(props: {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: keyof Palette;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Feather
      name={props.name}
      size={props.size ?? ICON_SIZE.inline}
      color={theme.palette[props.color ?? 'inkSoft']}
    />
  );
}
