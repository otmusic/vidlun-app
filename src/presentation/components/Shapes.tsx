import { View } from 'react-native';

/**
 * The handful of glyphs the capture flow needs, drawn from plain views so the
 * app carries no icon library yet. §7.4 wants a proper set with Dynamic Type
 * support; sizing here is already token-driven so that swap stays local.
 */

export function MicShape(props: { readonly color: string; readonly size: number }): React.JSX.Element {
  const capsuleWidth = props.size * 0.34;

  return (
    <View style={{ width: props.size, height: props.size, alignItems: 'center' }}>
      <View
        style={{
          width: capsuleWidth,
          height: props.size * 0.5,
          borderRadius: capsuleWidth / 2,
          backgroundColor: props.color,
        }}
      />
      <View
        style={{
          width: props.size * 0.62,
          height: props.size * 0.31,
          borderWidth: props.size * 0.07,
          borderTopColor: 'transparent',
          borderLeftColor: props.color,
          borderRightColor: props.color,
          borderBottomColor: props.color,
          borderBottomLeftRadius: props.size * 0.31,
          borderBottomRightRadius: props.size * 0.31,
          marginTop: props.size * 0.04,
        }}
      />
      <View
        style={{
          width: props.size * 0.07,
          height: props.size * 0.11,
          backgroundColor: props.color,
        }}
      />
    </View>
  );
}

export function StopShape(props: { readonly color: string; readonly size: number }): React.JSX.Element {
  return (
    <View
      style={{
        width: props.size * 0.62,
        height: props.size * 0.62,
        borderRadius: props.size * 0.16,
        backgroundColor: props.color,
      }}
    />
  );
}

export function KeyboardShape(props: {
  readonly color: string;
  readonly size: number;
}): React.JSX.Element {
  return (
    <View
      style={{
        width: props.size,
        height: props.size * 0.66,
        borderRadius: props.size * 0.14,
        borderWidth: 1.4,
        borderColor: props.color,
        paddingHorizontal: props.size * 0.14,
        justifyContent: 'center',
        gap: props.size * 0.12,
      }}
    >
      <View style={{ height: 1.4, backgroundColor: props.color }} />
      <View style={{ height: 1.4, backgroundColor: props.color, width: '60%', alignSelf: 'center' }} />
    </View>
  );
}

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
