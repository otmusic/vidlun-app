import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/tokens';
import { MIN_TAP_TARGET } from '../theme/tokens';
import { AppText } from './AppText';

export interface MoodScaleProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly lowLabel: string;
  readonly highLabel: string;
  readonly accessibilityLabel: string;
}

const POINTS = [1, 2, 3, 4, 5];

/**
 * There is no signalling red on this scale: the lowest state is a warm
 * terracotta, because a difficult day must not look like an error.
 */
function toneFor(point: number): keyof Palette {
  if (point <= 1) {
    return 'low';
  }

  return point <= 3 ? 'tension' : 'calm';
}

export function MoodScale(props: MoodScaleProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View accessibilityLabel={props.accessibilityLabel}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {POINTS.map((point) => {
          const selected = point === props.value;
          const dot = selected ? 27 : 20;

          return (
            <Pressable
              key={point}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={String(point)}
              onPress={() => {
                props.onChange(point);
              }}
              style={{
                minWidth: MIN_TAP_TARGET,
                minHeight: MIN_TAP_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: theme.palette[toneFor(point)],
                  opacity: selected ? 1 : 0.4,
                  borderWidth: selected ? 3 : 0,
                  borderColor: theme.palette[`${toneFor(point)}Soft` as keyof Palette],
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="caption" color="inkFaint">
          {props.lowLabel}
        </AppText>
        <AppText variant="caption" color="inkFaint">
          {props.highLabel}
        </AppText>
      </View>
    </View>
  );
}
