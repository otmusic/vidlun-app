import { Pressable, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import type { Translate, TranslationKey } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';

export type Tab = 'home' | 'journal' | 'search' | 'me';

export const TABS: readonly Tab[] = ['home', 'journal', 'search', 'me'];

const LABELS: Record<Tab, TranslationKey> = {
  home: 'tab.home',
  journal: 'tab.journal',
  search: 'tab.search',
  me: 'tab.me',
};

/**
 * A bar that floats over the content rather than sitting under it, so the
 * journal keeps running behind it and nothing has a hard bottom edge. Screens
 * beneath leave room for it in their own bottom padding.
 *
 * The selected tab is a filled disc, not a coloured glyph: the accent means
 * Vidlun is speaking, and which page you are on is not Vidlun speaking.
 */
export function TabBar(props: {
  readonly active: Tab;
  readonly t: Translate;
  readonly onSelect: (tab: Tab) => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 26,
        height: 66,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.bar,
        borderWidth: 1,
        borderColor: theme.palette.line,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
      }}
    >
      {TABS.map((tab) => {
        const selected = tab === props.active;

        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={props.t(LABELS[tab])}
            onPress={() => {
              props.onSelect(tab);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: selected ? theme.palette.solid : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TabGlyph
                tab={tab}
                color={selected ? theme.palette.onSolid : theme.palette.inkSoft}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const STROKE = 2.1;

function TabGlyph(props: { readonly tab: Tab; readonly color: string }): React.JSX.Element {
  const line = {
    fill: 'none',
    stroke: props.color,
    strokeWidth: STROKE,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      {props.tab === 'home' ? (
        <>
          <Path d="M3 11.4 12 4l9 7.4" {...line} />
          <Path d="M5.6 10.6V20h12.8v-9.4" {...line} />
        </>
      ) : null}
      {props.tab === 'journal' ? (
        <>
          <Path d="M6 3.6h10.5a1.9 1.9 0 0 1 1.9 1.9V20.4H7.9A1.9 1.9 0 0 1 6 18.5V3.6Z" {...line} />
          <Path d="M9.6 8.4h5.4M9.6 12.4h5.4" {...line} />
        </>
      ) : null}
      {props.tab === 'search' ? (
        <>
          <Circle cx={10.6} cy={10.6} r={6.4} fill="none" stroke={props.color} strokeWidth={STROKE} />
          <Path d="M15.4 15.4 20 20" {...line} />
        </>
      ) : null}
      {props.tab === 'me' ? (
        <>
          <Circle cx={12} cy={8.4} r={3.8} fill="none" stroke={props.color} strokeWidth={STROKE} />
          <Path d="M4.8 20c1.6-4 4.3-5.6 7.2-5.6s5.6 1.6 7.2 5.6" {...line} />
        </>
      ) : null}
    </Svg>
  );
}
