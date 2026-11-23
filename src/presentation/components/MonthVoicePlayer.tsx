import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Path, Rect, Svg } from 'react-native-svg';

import { listenForTracks, type TrackDirection } from '../../../modules/vidlun-voice';
import artwork from '../../../assets/month-voice-artwork.png';

import type { PlayableMonth } from '@/application/use-cases/ComposeMonthVoice';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { lengthOf, type MonthVoice, type MonthVoiceMode } from '@/domain/entities/MonthVoice';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from './AppText';
import { toneFor } from './emotionTone';
import {
  lengthWords,
  monthSpanWords,
  nextStart,
  partAt,
  playedOf,
  previousStart,
  whenSaid,
} from '../screens/monthVoiceView';
import { useTheme } from '../theme/ThemeProvider';

/** Playing on with the screen off, alone, with the lock screen's controls (they need `doNotMix`). */
const MONTH_SESSION = {
  playsInSilentMode: true,
  allowsRecording: false,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
} as const;

/**
 * The lock screen's and the Dynamic Island's picture: Vidlun's mark on its
 * dark ground, the same for every take (owner's pick, 2026-11-23: variant A).
 * Nothing on the lock screen comes from what was said: anyone near can see it.
 */
const ARTWORK_URL = Image.resolveAssetSource(artwork).uri;

/** What every other screen plays with: in the foreground only, alongside other apps. */
const USUAL_SESSION = {
  playsInSilentMode: true,
  allowsRecording: false,
  shouldPlayInBackground: false,
  interruptionMode: 'mixWithOthers',
} as const;

/**
 * The month heard in its own voice, under the month's prose (owner's word,
 * 2026-11-23). Before it plays: a strip of the month's takes, one piece a
 * take in the colour of its mood, so the month shows before a sound is
 * heard; how many and how long; and the way to choose between a few seconds
 * of each take and the takes in full.
 *
 * While it plays: which take of how many, the day and the sentence being
 * heard — a tap opens the entry — and back, pause and on. It plays on with
 * the screen off, with the lock screen's controls, like a podcast.
 */
export function MonthVoicePlayer(props: {
  readonly voice: MonthVoice;
  readonly locale: Locale;
  readonly t: Translate;
  /** The month as its prose names it ("Your October"), for the lock screen. */
  readonly title: string;
  readonly compose: (voice: MonthVoice, mode: MonthVoiceMode) => Promise<PlayableMonth | null>;
  readonly onOpenEntry: (entry: MoodEntry) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { voice, locale, t, compose } = props;
  const [mode, setMode] = useState<MonthVoiceMode>('glimpse');
  const [playable, setPlayable] = useState<PlayableMonth | null>(null);
  const [preparing, setPreparing] = useState(true);
  /** Asked to play before the month was ready, or carried over from the other mode. */
  const [wanted, setWanted] = useState<{ readonly fromEntry: string | null } | null>(null);
  const [started, setStarted] = useState(false);
  const player = useAudioPlayer(playable === null ? null : { uri: playable.uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const nowMs = status.currentTime * 1000;
  const parts = playable?.parts ?? [];
  const current = partAt(parts, nowMs);
  const part = started ? parts[current] : undefined;
  const lockShown = useRef(false);
  /** The lock screen's ◀◀ ▶▶ read these, as they stand when pressed. */
  const where = useRef({ parts, nowMs });

  where.current = { parts, nowMs };

  /** Takes the lock screen's ◀◀ ▶▶ away; set while the month is playing from the start of a listen. */
  const stopTracks = useRef<(() => void) | null>(null);

  // Joined again whenever the mode changes; the first one at once, so the play button answers at once.
  useEffect(() => {
    let cancelled = false;

    setPlayable(null);
    setPreparing(true);
    void compose(voice, mode)
      .catch(() => null)
      .then((joined) => {
        if (!cancelled) {
          setPlayable(joined);
          setPreparing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compose, voice, mode]);

  /** The day and time of the take on the first line, the month and how far on the second. */
  const metadataOf = useCallback(
    (at: number, of: readonly { readonly entry: MoodEntry }[]) => {
      const entry = of[at]?.entry;

      return {
        title: entry === undefined ? props.title : whenSaid(entry.createdAt, locale),
        artist:
          entry === undefined
            ? 'Vidlun'
            : `${props.title} · ${t('monthVoice.position', { n: at + 1, total: of.length })}`,
        artworkUrl: ARTWORK_URL,
      };
    },
    [locale, props.title, t],
  );

  /** ◀◀ ▶▶ from the lock screen go where the page's own buttons go. */
  const skip = useCallback(
    (direction: TrackDirection) => {
      const { parts: now, nowMs: at } = where.current;
      const target = direction === 'next' ? nextStart(now, at) : previousStart(now, at);

      if (target !== null) {
        void player.seekTo(target / 1000);
      }
    },
    [player],
  );

  const begin = useCallback(
    async (fromEntry: string | null): Promise<void> => {
      if (playable === null) {
        return;
      }

      const fromAt = playable.parts.findIndex((each) => each.entry.id === fromEntry);
      const from = playable.parts[fromAt];

      // The session first: the lock screen takes to a player only once it plays alone.
      await setAudioModeAsync(MONTH_SESSION).catch(() => undefined);

      try {
        player.setActiveForLockScreen(true, metadataOf(Math.max(0, fromAt), playable.parts));
        lockShown.current = true;
      } catch {
        // Plays on without the lock screen's controls.
      }

      stopTracks.current?.();
      stopTracks.current = listenForTracks(skip);

      if (from !== undefined) {
        void player.seekTo(from.startMs / 1000);
      } else if (status.didJustFinish || nowMs >= (playable.parts.at(-1)?.endMs ?? 0)) {
        void player.seekTo(0);
      }

      player.play();
      setStarted(true);
    },
    [metadataOf, nowMs, playable, player, skip, status.didJustFinish],
  );

  // A play asked for while the month was being joined goes ahead once it is.
  useEffect(() => {
    if (wanted !== null && playable !== null && status.isLoaded) {
      setWanted(null);
      void begin(wanted.fromEntry);
    }
  }, [begin, playable, status.isLoaded, wanted]);

  // The lock screen names the take being heard, and how far into the month it is.
  const playingAt = part === undefined ? null : current;

  useEffect(() => {
    if (!lockShown.current || playingAt === null || playable === null) {
      return;
    }

    try {
      player.updateLockScreenMetadata(metadataOf(playingAt, playable.parts));
    } catch {
      // The name on the lock screen stays as it was.
    }
  }, [playingAt, playable, player, metadataOf]);

  // At the end the block goes back to how it looked before it played.
  useEffect(() => {
    if (status.didJustFinish) {
      setStarted(false);
      void player.seekTo(0);
    }
  }, [player, status.didJustFinish]);

  // The ◀◀ ▶▶ go with the page.
  useEffect(
    () => () => {
      stopTracks.current?.();
      stopTracks.current = null;
    },
    [],
  );

  // Leaving the page lets the lock screen and the background go, for every other player.
  useEffect(
    () => () => {
      try {
        player.clearLockScreenControls();
      } catch {
        // Released with the player already.
      }

      void setAudioModeAsync(USUAL_SESSION).catch(() => undefined);
    },
    [player],
  );

  const toggle = (): void => {
    if (status.playing) {
      player.pause();

      return;
    }

    if (playable === null || !status.isLoaded) {
      setWanted({ fromEntry: null });

      return;
    }

    void begin(null);
  };

  const choose = (next: MonthVoiceMode): void => {
    if (next === mode) {
      return;
    }

    // Playing, it plays on in the other mode from the same take; paused, it starts over.
    if (status.playing && part !== undefined) {
      player.pause();
      setWanted({ fromEntry: part.entry.id });
    } else {
      setWanted(null);
    }

    setStarted(false);
    setMode(next);
  };

  const open = (entry: MoodEntry): void => {
    player.pause();
    props.onOpenEntry(entry);
  };

  const strip = playable === null ? voice.voiced.map(({ entry }) => entry) : parts.map(({ entry }) => entry);
  const count = strip.length;
  const length = lengthWords(lengthOf(voice, mode));
  const span = monthSpanWords(voice.monthStart, locale);
  const waiting = wanted !== null;
  const next = nextStart(parts, nowMs);

  // A month that could not be joined is not offered: a play button that does nothing would be worse.
  if (!preparing && playable === null) {
    return <></>;
  }

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 22,
          backgroundColor: theme.palette.paper,
          padding: 20,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <AppText variant="caption" color="inkFaint">
            {t('monthVoice.title')}
          </AppText>
          {part === undefined ? null : (
            // Not in the caption's capitals: the Ukrainian word for "of", capitalised, reads as a 3.
            <AppText variant="secondary" color="inkFaint" style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {t('monthVoice.position', { n: current + 1, total: count })}
            </AppText>
          )}
        </View>

        {/* One piece a take, in the colour of its mood: the month at a glance. */}
        <View accessible={false} style={{ flexDirection: 'row', gap: 3 }}>
          {strip.map((entry, at) => {
            const colour = entry.mood === null ? theme.palette.lineStrong : theme.palette[toneFor(entry.mood.value)];
            const playing = part !== undefined && at === current;
            const ahead = part !== undefined && at > current;
            const share = playing && parts[at] !== undefined ? playedOf(parts[at], nowMs) : 1;

            return (
              <View
                key={entry.id}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  backgroundColor: colour,
                  opacity: part === undefined ? 0.85 : ahead ? 0.3 : 1,
                }}
              >
                {playing ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      left: `${Math.round(share * 100)}%`,
                      backgroundColor: theme.palette.paper,
                      opacity: 0.6,
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {part === undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <PlayButton
              playing={false}
              waiting={waiting}
              label={t('monthVoice.play')}
              onPress={toggle}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body">
                {t('monthVoice.summary', {
                  entries: t(countedKey('monthVoice.entries', count, locale), { n: count }),
                  length: t(length.unit === 'minutes' ? 'monthVoice.minutes' : 'monthVoice.seconds', {
                    n: length.n,
                  }),
                })}
              </AppText>
              <AppText variant="secondary" color="inkSoft">
                {t('monthVoice.days', span)}
              </AppText>
            </View>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('monthVoice.openEntry')}
              onPress={() => {
                open(part.entry);
              }}
              style={{ gap: 6 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 9,
                    backgroundColor:
                      part.entry.mood === null
                        ? theme.palette.lineStrong
                        : theme.palette[toneFor(part.entry.mood.value)],
                  }}
                />
                <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13 }}>
                  {whenSaid(part.entry.createdAt, locale)}
                </AppText>
              </View>
              <AppText variant="body" numberOfLines={3}>
                {`«${part.entry.cleanTranscript}»`}
              </AppText>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
              <SkipButton
                direction="back"
                label={t('monthVoice.previous')}
                onPress={() => {
                  void player.seekTo(previousStart(parts, nowMs) / 1000);
                }}
              />
              <PlayButton
                playing={status.playing}
                waiting={false}
                label={t(status.playing ? 'monthVoice.pause' : 'monthVoice.play')}
                onPress={toggle}
              />
              <SkipButton
                direction="on"
                label={t('monthVoice.next')}
                disabled={next === null}
                onPress={() => {
                  if (next !== null) {
                    void player.seekTo(next / 1000);
                  }
                }}
              />
            </View>
          </>
        )}

        <ModeSwitch mode={mode} t={t} onChange={choose} />
      </View>
    </View>
  );
}

function PlayButton(props: {
  readonly playing: boolean;
  readonly waiting: boolean;
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ busy: props.waiting }}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.palette.solid,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed && !theme.reduceMotion ? 0.95 : 1 }],
      })}
    >
      {props.waiting ? (
        <ActivityIndicator color={theme.palette.onSolid} />
      ) : (
        <Svg width={20} height={20} viewBox="0 0 20 20">
          {props.playing ? (
            <>
              <Rect x={5} y={3.5} width={3.4} height={13} rx={1} fill={theme.palette.onSolid} />
              <Rect x={11.6} y={3.5} width={3.4} height={13} rx={1} fill={theme.palette.onSolid} />
            </>
          ) : (
            <Path d="M6 3.6 16 10 6 16.4z" fill={theme.palette.onSolid} />
          )}
        </Svg>
      )}
    </Pressable>
  );
}

/** Back to the start of a take, or on to the next: the drawing's bar-and-triangle marks. */
function SkipButton(props: {
  readonly direction: 'back' | 'on';
  readonly label: string;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const colour = props.disabled === true ? theme.palette.lineStrong : theme.palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={6}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {props.direction === 'back' ? (
          <Path
            d="M19 20 9 12l10-8v16zM5 19V5"
            stroke={colour}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <Path
            d="m5 4 10 8-10 8V4zM19 5v14"
            stroke={colour}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </Svg>
    </Pressable>
  );
}

/** "10 seconds each" or "in full", as the language switch in Me is drawn. */
function ModeSwitch(props: {
  readonly mode: MonthVoiceMode;
  readonly t: Translate;
  readonly onChange: (mode: MonthVoiceMode) => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: theme.palette.lineSoft }}>
      {(['glimpse', 'whole'] as const).map((mode) => {
        const chosen = props.mode === mode;

        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            onPress={() => {
              props.onChange(mode);
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 4,
              borderRadius: 999,
              backgroundColor: chosen ? theme.palette.paper : 'transparent',
            }}
          >
            <AppText variant="secondary" color={chosen ? 'ink' : 'inkSoft'} numberOfLines={1}>
              {props.t(mode === 'glimpse' ? 'monthVoice.glimpse' : 'monthVoice.whole')}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
