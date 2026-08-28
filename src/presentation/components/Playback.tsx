import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { Translate } from '@/i18n';

import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';

/** A fixed shape rather than the take's real amplitudes, which we do not keep. */
const WAVE = [
  8, 14, 22, 30, 18, 11, 25, 33, 20, 13, 9, 17, 28, 34, 24, 15, 10, 21, 31, 26, 16, 12, 19, 29,
  23, 14, 9, 18, 27, 20, 13, 10, 15, 8,
];

/**
 * The voice, kept and playable. The bars are a shape, not a reading of this
 * particular take: analysing a year of audio to draw a waveform would mean
 * keeping and processing far more of someone's voice than showing them a play
 * button is worth.
 *
 * Its own component so the player is created only for an entry that has audio
 * — hooks cannot be called conditionally.
 */
export function Playback(props: {
  readonly uri: string;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const player = useAudioPlayer(props.uri);
  const status = useAudioPlayerStatus(player);
  const played = status.duration > 0 ? status.currentTime / status.duration : 0;

  const toggle = (): void => {
    if (status.playing) {
      player.pause();

      return;
    }

    // Rewind at the end, or a second tap does nothing and looks broken.
    if (status.didJustFinish || status.currentTime >= status.duration) {
      void player.seekTo(0);
    }

    player.play();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: theme.palette.line,
        borderRadius: 26,
        backgroundColor: theme.palette.paper,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.t(status.playing ? 'detail.pause' : 'detail.play')}
        onPress={toggle}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: theme.palette.solid,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed && !theme.reduceMotion ? 0.95 : 1 }],
        })}
      >
        <Svg width={17} height={17} viewBox="0 0 20 20">
          {status.playing ? (
            <Path d="M6.4 4h3.1v12H6.4zM10.9 4H14v12h-3.1z" fill={theme.palette.onSolid} />
          ) : (
            <Path d="M6 3.6 16 10 6 16.4z" fill={theme.palette.onSolid} />
          )}
        </Svg>
      </Pressable>

      {/*
        * Progress is the bars filling in rather than a line under them: the
        * waveform is already the shape of the take, and a second indicator
        * would be two ways of saying where you are.
        */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 34 }}>
        {WAVE.map((height, at) => (
          <View
            key={at}
            style={{
              flex: 1,
              height,
              borderRadius: 2,
              backgroundColor:
                at / WAVE.length <= played ? theme.palette.accent : theme.palette.line,
            }}
          />
        ))}
      </View>

      <AppText variant="secondary" color="inkSoft" style={{ fontVariant: ['tabular-nums'] }}>
        {clock(status.playing ? status.currentTime : status.duration)}
      </AppText>
    </View>
  );
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
