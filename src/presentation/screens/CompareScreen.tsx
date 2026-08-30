import { Pressable, ScrollView, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { emotionKey, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { moodTone } from '../components/emotionTone';
import { WaveMark } from '../components/WaveMark';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';
import { differenceBetween } from './difference';

const MOOD_LABELS: readonly TranslationKey[] = ['mood.1', 'mood.2', 'mood.3', 'mood.4', 'mood.5'];
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Two answers, side by side and never merged, with a third block naming the
 * difference in the person's own words.
 *
 * Vidlun's block is a place rather than a colour: its own violet surface, so
 * "this half is not yours" reads without the accent having to mean a second
 * thing. Nothing here ranks the two — a word Vidlun missed is as much a
 * finding as a word it added.
 */
export function CompareScreen(props: {
  readonly proposed: MoodEntry;
  readonly draft: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  readonly onAdopt: (id: string) => void;
  readonly onKeepMine: () => void;
  readonly keptMine: boolean;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';
  const mine = props.draft.selfEmotionIds;
  const difference = differenceBetween(mine, props.proposed.emotionIds);
  /** §6 calls an empty proposal correct and common; the drawing gives it a state. */
  const heardNothing = props.proposed.emotionIds.length === 0;

  const colorOf = (id: string): string | undefined => {
    const emotion = props.vocabulary.find(id);

    return emotion === undefined ? undefined : colorForEmotion(props.vocabulary, emotion, scheme);
  };

  const label = (id: string): string => props.t(emotionKey(id));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{
        paddingTop: 70,
        paddingHorizontal: 22,
        paddingBottom: 34,
        gap: 10,
      }}
    >
      <View style={{ marginBottom: 12 }}>
        <BackButton t={props.t} onPress={props.onBack} />
      </View>

      <AppText variant="caption" color="inkFaint">
        {props.t('compare.eyebrow')}
      </AppText>

      <Block bordered>
        <AppText variant="caption" color="inkFaint">
          {props.t('compare.mine')}
        </AppText>
        {mine.length === 0 ? (
          <AppText variant="secondary" color="inkFaint">
            {props.t('compare.mineEmpty')}
          </AppText>
        ) : (
          <Row>
            {mine.map((id) => (
              <Chip key={id} label={label(id)} color={colorOf(id)} />
            ))}
          </Row>
        )}
      </Block>

      <Block surface={theme.palette.voiceSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Sparkle colour={theme.palette.accentInk} />
          <AppText variant="caption" color="accentInk">
            {props.t(heardNothing ? 'compare.lunaNone' : 'compare.luna')}
          </AppText>
        </View>
        {heardNothing ? (
          /*
           * Not an empty slot but a finding, and one §6 calls correct and
           * common: an entry about what the day held rather than how it felt
           * has no emotion in it to hear. The way out is offered, never taken
           * on the person's behalf.
           */
          <>
            <AppText variant="body">{props.t('compare.noneCopy')}</AppText>
            {props.draft.selfEmotionIds.length > 0 ? (
              <AppText variant="secondary" color="inkSoft" style={{ paddingTop: 14 }}>
                {props.t('compare.noneKept')}
              </AppText>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={props.onEdit}
                hitSlop={8}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 14,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.palette.line,
                  borderRadius: 999,
                  paddingVertical: 9,
                  paddingHorizontal: 16,
                }}
              >
                <AppText variant="secondary" color="inkSoft">
                  {`+ ${props.t('compare.noneName')}`}
                </AppText>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Row>
              {props.proposed.emotionIds.map((id) => {
                const kept = props.draft.emotionIds.includes(id);

                /*
                 * A word already in the entry is solid; one Vidlun offers is a
                 * ring with a plus, and tapping it moves it across. The
                 * difference is the whole interaction — there is no accept
                 * button, because accepting everything at once is not a thing
                 * anyone means.
                 */
                return kept ? (
                  <Chip key={id} label={label(id)} color={colorOf(id)} solid />
                ) : (
                  <Chip
                    key={id}
                    label={`+ ${label(id)}`}
                    color={colorOf(id)}
                    onPress={() => {
                      props.onAdopt(id);
                    }}
                  />
                );
              })}
            </Row>
            {props.keptMine ? (
              <AppText variant="secondary" color="inkSoft">
                {props.t('compare.kept')}
              </AppText>
            ) : (
              /*
               * As prominent as adopting, and deliberately so: Vidlun is not an
               * authority on someone else's feelings, and disagreeing has to be
               * one tap rather than a thing you do by ignoring the screen.
               */
              <Pressable accessibilityRole="button" onPress={props.onKeepMine} hitSlop={12}>
                <AppText variant="label" color="accentInk">
                  {props.t('compare.keepMine')}
                </AppText>
              </Pressable>
            )}
          </>
        )}
      </Block>

      {heardNothing ? null : (
      <Block bordered>
        <AppText variant="body">
          {props.t(`diff.${difference.kind}`, {
            word: difference.word === undefined ? '' : label(difference.word),
            mine: difference.mine === undefined ? '' : label(difference.mine),
            theirs: difference.theirs === undefined ? '' : label(difference.theirs),
          })}
        </AppText>
      </Block>
      )}

      {heardNothing ? (
        /*
         * The observation would be about a feeling there was none of, so the
         * drawing gives this state its own line instead.
         */
        <Block surface={theme.palette.panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <WaveMark width={26} color={theme.palette.lime} />
            <AppText variant="caption" color="tileInk">
              {props.t('compare.echo')}
            </AppText>
          </View>
          <AppText variant="quote" color="onPanel">
            {props.t('compare.noneEcho')}
          </AppText>
        </Block>
      ) : props.draft.observation === null ? null : (
        <Block surface={theme.palette.panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <WaveMark width={26} color={theme.palette.lime} />
            <AppText variant="caption" color="tileInk">
              {props.t('compare.echo')}
            </AppText>
          </View>
          <AppText variant="quote" color="onPanel">
            {props.draft.observation}
          </AppText>
        </Block>
      )}

      {heardNothing || props.draft.mood === null ? null : (
      <Block bordered>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <MoodRing value={props.draft.mood.value} />
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="caption" color="inkFaint">
              {props.t('compare.mood')}
            </AppText>
            <AppText variant="body" color={moodTone(props.draft.mood.value)}>
              {props.t(MOOD_LABELS[props.draft.mood.value - 1] ?? 'mood.3')}
            </AppText>
          </View>
        </View>
      </Block>
      )}

      {props.draft.contextTags.length > 0 ? (
        <Row>
          {props.draft.contextTags.map((tag) => (
            <Chip key={tag} label={tag} tone="neutral" />
          ))}
        </Row>
      ) : null}

      <View style={{ gap: theme.spacing.xs, marginTop: 12 }}>
        <Button label={props.t('reflection.confirm')} onPress={props.onConfirm} />
        <Button label={props.t('reflection.edit')} variant="ghost" onPress={props.onEdit} />
      </View>
    </ScrollView>
  );
}

function Block(props: {
  readonly children: React.ReactNode;
  readonly bordered?: boolean;
  readonly surface?: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: 20,
        padding: 18,
        gap: 12,
        backgroundColor: props.surface ?? (props.bordered === true ? theme.palette.paper : 'transparent'),
        borderWidth: props.bordered === true ? 1 : 0,
        borderColor: theme.palette.line,
      }}
    >
      {props.children}
    </View>
  );
}

function Row(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{props.children}</View>
  );
}

/** The mood as a share of the ring rather than a number: it is a feeling. */
function MoodRing(props: { readonly value: number }): React.JSX.Element {
  const theme = useTheme();
  const filled = (props.value / 5) * RING_LENGTH;

  return (
    <Svg width={52} height={52} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={theme.palette.line} strokeWidth={7} />
      <Circle
        cx={36}
        cy={36}
        r={RING_RADIUS}
        fill="none"
        stroke={theme.palette[moodTone(props.value)]}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${RING_LENGTH}`}
        transform="rotate(-90 36 36)"
      />
    </Svg>
  );
}

/** The drawing's four-point star beside "Vidlun heard". */
function Sparkle(props: { readonly colour: string }): React.JSX.Element {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Path
        d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"
        fill={props.colour}
      />
    </Svg>
  );
}
