import { View } from 'react-native';

import { type CardTopics as Topics, keptTopics, MAX_TOPICS, TOPIC_MAX_LENGTH } from '@/domain/entities/Topic';
import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { AddPill, ChipField } from './ChipField';

/**
 * What the entry was about, under the words it was read from, and the one
 * place its topics change (owner's word, 2026-10-01 and 2026-11-23): one of
 * Vidlun's taken off stays, faded, so a slip is undone with the same tap, and
 * one Vidlun missed is written into a chip in the row, with its own tick.
 * Only here, before the entry is saved; a kept entry's topics do not change.
 * Nothing is offered while typing (owner's word, 2026-11-23). Controlled
 * from the card, so a topic still being typed when the person goes on goes
 * in first.
 */
export function CardTopics(props: {
  readonly topics: Topics;
  /** Null while the chip is closed; the topic so far while open. */
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
    <View style={{ gap: theme.spacing.sm }}>
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
          <ChipField
            value={props.typing}
            placeholder={t('turn.topicPlaceholder')}
            label={t('turn.topicAdd')}
            maxLength={TOPIC_MAX_LENGTH}
            autoCapitalize="none"
            onChange={props.onChange}
            onCommit={props.onCommit}
          />
        )}
        {props.typing !== null || kept.length >= MAX_TOPICS ? null : (
          <AddPill label={t('turn.topicAdd')} onPress={props.onOpen} />
        )}
      </View>
    </View>
  );
}
