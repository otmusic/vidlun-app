import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CardHeader } from '../components/CardHeader';
import { CardPage } from '../components/CardPage';
import { MoodList } from '../components/MoodList';

/**
 * The card's last step: the mood, on a page of its own after the feelings
 * (owner's word, 2026-11-23). Vidlun's reading is already chosen, so someone
 * who agrees saves with one tap; a tap on another row changes it. No mark
 * saying whose it is (owner's word): the chosen row says it.
 */
export function CardMoodScreen(props: {
  readonly createdAt: Date;
  /** The person's choice, or Vidlun's reading until they make one; null when neither has one. */
  readonly mood: number | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onMood: (value: number) => void;
  readonly onSave: () => void;
  readonly onBack: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const { t } = props;

  return (
    <CardPage footer={<Button label={t('card.save')} onPress={props.onSave} />}>
      <CardHeader
        step={3}
        createdAt={props.createdAt}
        locale={props.locale}
        t={t}
        onBack={props.onBack}
        onDiscard={props.onDiscard}
      />
      <AppText variant="display">{t('card.mood')}</AppText>
      <MoodList value={props.mood} t={t} onChange={props.onMood} />
    </CardPage>
  );
}
