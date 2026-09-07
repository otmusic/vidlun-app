import { useEffect, useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

import { MILESTONE_LABEL_MAX, type Milestone } from '@/domain/entities/Milestone';
import type { Locale, Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Sheet } from './Sheet';

/** What the sheet is open for: a new mark on today, or one already marked. */
export interface MilestoneSheetState {
  readonly editing: Milestone | null;
}

/**
 * The drawing's milestone sheet: one field for what happened, the day it is
 * marked on — today for a new one, as the drawing has it — and the reason
 * milestones exist. Deleting lives here too, quietly, below saving.
 */
export function MilestoneSheet(props: {
  readonly open: MilestoneSheetState | null;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  readonly onSave: (label: string) => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = props;
  const editing = props.open?.editing ?? null;
  const [label, setLabel] = useState('');
  const ready = label.trim().length > 0;

  // The field opens with the milestone's own words, or empty for a new one.
  useEffect(() => {
    setLabel(editing?.label ?? '');
  }, [editing, props.open]);

  const close = (): void => {
    Keyboard.dismiss();
    props.onClose();
  };

  const save = (): void => {
    if (!ready) {
      return;
    }

    Keyboard.dismiss();
    props.onSave(label.trim());
  };

  const day = editing?.day ?? props.today;
  const isToday = startOfDay(day).getTime() === startOfDay(props.today).getTime();
  const when = day.toLocaleDateString(props.locale, { day: 'numeric', month: 'long' });

  return (
    <Sheet open={props.open !== null} closeLabel={t('milestone.cancel')} onClose={close}>
      <AppText variant="display" style={{ fontSize: 22, lineHeight: 28 }}>
        {t(editing === null ? 'milestone.mark' : 'milestone.edit')}
      </AppText>
      <View style={{ gap: 6 }}>
        <AppText variant="caption" color="inkFaint" style={{ fontSize: 11.5 }}>
          {t('milestone.what')}
        </AppText>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('milestone.placeholder')}
          placeholderTextColor={theme.palette.inkFaint}
          maxLength={MILESTONE_LABEL_MAX}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          style={{
            ...theme.type.body,
            color: theme.palette.ink,
            backgroundColor: theme.palette.canvas,
            borderWidth: 1,
            borderColor: theme.palette.line,
            borderRadius: 999,
            paddingVertical: 15,
            paddingHorizontal: 18,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingTop: 4,
          paddingHorizontal: 4,
        }}
      >
        <AppText variant="caption" color="inkFaint" style={{ fontSize: 11.5 }}>
          {t('milestone.when')}
        </AppText>
        <AppText variant="body">{isToday ? `${when} · ${t('milestone.today')}` : when}</AppText>
      </View>
      <AppText
        variant="caption"
        color="inkFaint"
        style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 19 }}
      >
        {t('milestone.hint')}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        onPress={save}
        style={{
          marginTop: 4,
          borderRadius: 999,
          backgroundColor: ready ? theme.palette.solid : theme.palette.line,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <AppText variant="body" style={{ color: ready ? theme.palette.onSolid : theme.palette.inkFaint }}>
          {t('milestone.save')}
        </AppText>
      </Pressable>
      {editing === null ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Keyboard.dismiss();
            props.onDelete();
          }}
          style={{ paddingVertical: 10, alignItems: 'center' }}
        >
          <AppText variant="secondary" color="inkSoft">
            {t('milestone.delete')}
          </AppText>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" onPress={close} style={{ paddingVertical: 10, alignItems: 'center' }}>
        <AppText variant="secondary" color="inkFaint">
          {t('milestone.cancel')}
        </AppText>
      </Pressable>
    </Sheet>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
