import { View } from 'react-native';

/**
 * The handful of glyphs the capture flow needs, drawn from plain views so the
 * app carries no icon library yet. §7.4 wants a proper set with Dynamic Type
 * support; sizing here is already token-driven so that swap stays local.
 */

export function CheckShape(props: {
  readonly color: string;
  readonly size: number;
}): React.JSX.Element {
  return (
    <View style={{ width: props.size, height: props.size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: props.size * 0.42,
          height: props.size * 0.74,
          borderRightWidth: props.size * 0.11,
          borderBottomWidth: props.size * 0.11,
          borderColor: props.color,
          transform: [{ rotate: '45deg' }, { translateY: -props.size * 0.06 }],
        }}
      />
    </View>
  );
}

export function CloseShape(props: {
  readonly color: string;
  readonly size: number;
}): React.JSX.Element {
  return (
    <View style={{ width: props.size, height: props.size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: props.size * 0.8,
          height: 1.6,
          backgroundColor: props.color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: props.size * 0.8,
          height: 1.6,
          backgroundColor: props.color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}
