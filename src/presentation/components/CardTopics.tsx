import { Pressable, TextInput, View } from 'react-native';

import { type CardTopics as Topics, keptTopics, MAX_TOPICS, TOPIC_MAX_LENGTH } from '@/domain/entities/Topic';
import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { Icon } from './Icon';

/**
 * What the entry was about, under the words it was read from, and the one
 * place its topics change (owner's word, 2026-10-01 and 2026-11-23): one of
 * Vidlun's taken off stays, faded, so a slip is undone with the same tap, and
 * one Vidlun missed is written in. Only here, before the entry is saved; a
 * kept entry's topics do not change.
 *
 * The dashed pill becomes a chip that is typed into, where the topic will
 * stand, with its own round tick to add it (owner's pick of two drawings,
 * 2026-11-23; the canvas page on the topic field, A). In place, never in
 * a Modal: a sheet with a text field eats the first tap on iOS 26 while the
 * keyboard is up. Nothing is offered while typing (owner's word, the same
 * day). Controlled from the card, so a topic still being typed when the
 * person taps "next" goes in first.
 */
export function CardTopics(props: {
  readonly topics: Topics;
  /** Null while the line is closed; the topic so far while open. */
  readonly typing: string | null;
  readonly t: Translate;
  /** Takes a topic off, or puts one of Vidlun's back. */
  readonly onToggle: (topic: string) => void;
  readonly onOpen: () => void;
  readonly onChange: (text: string) => void;
  /** The tick, return, or the chip left: what is typed goes in, or the chip closes empty. */
  readonly onCommit: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t, topics } = props;
  const kept = keptTopics(topics);

  return (
    <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
      <AppText variant="caption" color="inkFaint">
        {t('entry.topics')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        {topics.proposed.map((topic) =>
          topics.dropped.includes(topic) ? (
            <View key={topic} style={{ opacity: 0.5 }}>
              <Chip
                label={`+ ${topic}`}
                tone="neutral"
                onPress={() => {
                  props.onToggle(topic);
                }}
              />
            </View>
          ) : (
            <Chip
              key={topic}
              label={topic}
              tone="neutral"
              action="remove"
              accessibilityLabel={t('turn.topicRemove', { topic })}
              onPress={() => {
                props.onToggle(topic);
              }}
            />
          ),
        )}
        {topics.added.map((topic) => (
          <Chip
            key={topic}
            label={topic}
            tone="neutral"
            action="remove"
            accessibilityLabel={t('turn.topicRemove', { topic })}
            onPress={() => {
              props.onToggle(topic);
            }}
          />
        ))}
        {props.typing === null ? null : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minWidth: 150,
              maxWidth: '100%',
              borderWidth: 1.5,
              borderColor: theme.palette.ink,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.palette.paper,
              paddingVertical: 3.5,
              paddingLeft: 13,
              paddingRight: 4,
            }}
          >
            <TextInput
              value={props.typing}
              onChangeText={props.onChange}
              autoFocus
              maxLength={TOPIC_MAX_LENGTH}
              // Topics read in lower case, as Vidlun writes them; a name typed with its capital keeps it.
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={props.onCommit}
              onBlur={props.onCommit}
              placeholder={t('turn.topicPlaceholder')}
              placeholderTextColor={theme.palette.inkFaint}
              accessibilityLabel={t('turn.topicAdd')}
              style={{
                ...theme.type.secondary,
                flexGrow: 1,
                flexShrink: 1,
                minWidth: 90,
                paddingVertical: 0,
                color: theme.palette.ink,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('turn.topicAdd')}
              hitSlop={10}
              onPress={props.onCommit}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                // Pale until there is something to add.
                backgroundColor: props.typing.trim().length > 0 ? theme.palette.ink : theme.palette.lineStrong,
              }}
            >
              <Icon name="check" size={14} color="onSolid" />
            </Pressable>
          </View>
        )}
        {props.typing !== null || kept.length >= MAX_TOPICS ? null : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={props.onOpen}
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.palette.lineStrong,
              borderRadius: theme.radii.pill,
              paddingVertical: 6,
              paddingHorizontal: 13,
            }}
          >
            <AppText variant="secondary" color="inkSoft">
              {`+ ${t('turn.topicAdd')}`}
            </AppText>
          </Pressable>
        )}
      </View>

    </View>
  );
}
