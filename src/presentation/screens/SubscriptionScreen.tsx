import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';

import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Plan, PurchaseOutcome } from '@/domain/ports/IPurchases';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { RoundBack } from '../components/RoundBack';
import { useTheme } from '../theme/ThemeProvider';
import { savingAgainstMonthly } from './planSaving';

const PLAN_LABELS = {
  monthly: 'subs.planMonthly',
  annual: 'subs.planAnnual',
  lifetime: 'subs.planLifetime',
} as const;

const PLAN_PERIODS = {
  monthly: 'subs.perMonth',
  annual: 'subs.perYear',
  lifetime: 'subs.once',
} as const;

/** Where "manage" goes. The store owns cancelling; we only point at it. */
const APP_STORE_SUBSCRIPTIONS = 'https://apps.apple.com/account/subscriptions';

/**
 * The one thing Vidlun sells, and what it costs.
 *
 * Two faces: an offer for someone who has not bought, and a receipt for
 * someone who has. It never blurs a paragraph of the person's own week to
 * argue for itself — what is behind the price is Vidlun's reading, and the
 * page says so in words instead.
 */
export function SubscriptionScreen(props: {
  readonly entitlement: Entitlement;
  readonly plans: readonly Plan[];
  readonly outcome: PurchaseOutcome | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onSubscribe: (planId: string) => void;
  readonly onRestore: () => void;
  readonly onDismissOutcome: () => void;
  readonly onOpenTerms: () => void;
  readonly onOpenPrivacy: () => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const owns = props.entitlement === 'subscribed';
  /*
   * The year is preselected, and that is the whole argument of the screen: the
   * month is here so the year can be read against it, and someone who never
   * touches these cards buys the one worth buying.
   */
  const [chosenId, setChosenId] = useState<string | null>(null);
  const preferred = props.plans.find((plan) => plan.kind === 'annual') ?? props.plans[0];
  const chosen = props.plans.find((plan) => plan.id === chosenId) ?? preferred;

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: 40 }}
      >
        <RoundBack t={t} onPress={props.onBack} />

        <AppText variant="display" style={{ marginBottom: 10 }}>
          {t('subs.title')}
        </AppText>
        <AppText variant="body" color="inkSoft" style={{ marginBottom: 24 }}>
          {t('subs.body')}
        </AppText>

        <View style={{ gap: 12, marginBottom: 28 }}>
          <Item label={t('subs.item1')} />
          <Item label={t('subs.item2')} />
        </View>

        {owns ? (
          <>
            <View
              style={{
                borderRadius: 22,
                backgroundColor: theme.palette.panel,
                padding: 22,
                gap: 8,
                marginBottom: 20,
              }}
            >
              <AppText variant="kicker" style={{ color: theme.palette.onPanel }}>
                {t('subs.manageTitle')}
              </AppText>
              <AppText variant="body" style={{ color: theme.palette.onPanel, opacity: 0.75 }}>
                {t('subs.manageBody')}
              </AppText>
            </View>
            <Outlined
              label={t('subs.manageBtn')}
              onPress={() => {
                void Linking.openURL(APP_STORE_SUBSCRIPTIONS);
              }}
            />
            <Quiet
              label={t('subs.cancel')}
              onPress={() => {
                void Linking.openURL(APP_STORE_SUBSCRIPTIONS);
              }}
            />
          </>
        ) : props.plans.length === 0 ? (
          /*
           * Nothing priced means the store has nothing to sell — not
           * configured, or unreachable. Saying so is better than an empty
           * space where a price belongs.
           */
          <AppText variant="body" color="inkSoft" style={{ marginBottom: 20 }}>
            {t('subs.storeQuiet')}
          </AppText>
        ) : (
          <>
            <AppText variant="caption" color="inkFaint" style={{ marginBottom: 12 }}>
              {t('subs.chooseTitle')}
            </AppText>
            <View style={{ gap: 10, marginBottom: 20 }}>
              {props.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  chosen={plan.id === chosenId}
                  saving={savingAgainstMonthly(plan, props.plans)}
                  locale={props.locale}
                  t={t}
                  onPress={() => {
                    setChosenId(plan.id);
                  }}
                />
              ))}
            </View>
            <Solid
              label={buyLabel(chosen, t, props.locale)}
              onPress={() => {
                if (chosen !== undefined) {
                  props.onSubscribe(chosen.id);
                }
              }}
            />
            <Quiet label={t('subs.restore')} onPress={props.onRestore} />
          </>
        )}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.palette.line,
            marginTop: 28,
            paddingTop: 20,
            gap: 16,
          }}
        >
          <AppText variant="secondary" color="inkSoft">
            {t('subs.free')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {/* Apple asks for these to work, and someone deciding whether to
                pay is exactly who wants to read them. */}
            <Pressable accessibilityRole="link" onPress={props.onOpenTerms} hitSlop={10}>
              <AppText variant="secondary" color="accentInk">
                {t('subs.terms')}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={props.onOpenPrivacy} hitSlop={10}>
              <AppText variant="secondary" color="accentInk">
                {t('subs.privacy')}
              </AppText>
            </Pressable>
          </View>
          <Outlined label={t('subs.notNow')} onPress={props.onBack} />
        </View>
      </ScrollView>

      <OutcomeSheet
        outcome={props.outcome}
        t={t}
        onRetry={() => {
          if (chosen !== undefined) {
            props.onSubscribe(chosen.id);
          }
        }}
        onClose={props.onDismissOutcome}
      />
    </View>
  );
}

/**
 * One plan, priced by the store and never by us. The year carries what it
 * saves against the month, worked out from the two real prices rather than
 * written into the copy — a percentage in a translation is a number that goes
 * stale the first time a price moves.
 */
function PlanCard(props: {
  readonly plan: Plan;
  readonly chosen: boolean;
  readonly saving: number | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { plan, t } = props;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.chosen }}
      onPress={props.onPress}
      style={{
        borderWidth: props.chosen ? 2 : 1,
        borderColor: props.chosen ? theme.palette.ink : theme.palette.line,
        backgroundColor: theme.palette.paper,
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 20,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AppText variant="body" style={{ fontSize: 16, flex: 1 }}>
          {t(PLAN_LABELS[plan.kind])}
        </AppText>
        {props.saving === null ? null : (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: theme.palette.lime,
              paddingVertical: 4,
              paddingHorizontal: 10,
            }}
          >
            <AppText variant="caption" style={{ color: theme.palette.ink }}>
              {t('subs.saving', { percent: props.saving })}
            </AppText>
          </View>
        )}
        <AppText variant="body" style={{ fontSize: 16 }}>
          {plan.price}
        </AppText>
      </View>
      <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none' }}>
        {plan.trialDays > 0
          ? t('subs.trialDays', {
              n: plan.trialDays,
              days: t(countedKey('subs.day', plan.trialDays, props.locale)),
            })
          : t(PLAN_PERIODS[plan.kind])}
      </AppText>
    </Pressable>
  );
}

function buyLabel(plan: Plan | undefined, t: Translate, locale: Locale): string {
  if (plan === undefined) {
    return t('subs.restore');
  }

  return plan.trialDays > 0
    ? t('subs.trialDays', {
        n: plan.trialDays,
        days: t(countedKey('subs.day', plan.trialDays, locale)),
      })
    : `${t('subs.buyFor')} ${plan.price}`;
}

function Item(props: { readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 7,
          marginTop: 9,
          backgroundColor: theme.palette.accent,
        }}
      />
      <AppText variant="body" style={{ flex: 1 }}>
        {props.label}
      </AppText>
    </View>
  );
}

/**
 * What the store said, in the three shapes worth a sentence. A cancelled
 * purchase is not among them: closing the sheet is an answer, and answering it
 * back would be the app arguing.
 */
function OutcomeSheet(props: {
  readonly outcome: PurchaseOutcome | null;
  readonly t: Translate;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { outcome, t } = props;

  if (outcome === null || outcome === 'cancelled' || outcome === 'bought') {
    return null;
  }

  const failed = outcome === 'failed';
  const title = failed
    ? 'buy.errTitle'
    : outcome === 'restored'
      ? 'buy.okTitle'
      : 'buy.noneTitle';
  const body = failed ? 'buy.errBody' : outcome === 'restored' ? 'buy.okBody' : 'buy.noneBody';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 22 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('buy.close')}
          onPress={props.onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            backgroundColor: theme.palette.paper,
            borderRadius: 26,
            padding: 24,
            gap: 10,
          }}
        >
          <AppText variant="kicker">{t(title)}</AppText>
          <AppText variant="body" color="inkSoft">
            {t(body)}
          </AppText>
          <View style={{ gap: 8, marginTop: 8 }}>
            {failed ? <Solid label={t('buy.retry')} onPress={props.onRetry} /> : null}
            <Quiet label={t(failed ? 'buy.close' : 'buy.fine')} onPress={props.onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Solid(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={{
        borderRadius: 999,
        backgroundColor: theme.palette.solid,
        paddingVertical: 16,
        alignItems: 'center',
      }}
    >
      <AppText variant="body" style={{ color: theme.palette.onSolid }}>
        {props.label}
      </AppText>
    </Pressable>
  );
}

function Outlined(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        paddingVertical: 15,
        alignItems: 'center',
      }}
    >
      <AppText variant="body">{props.label}</AppText>
    </Pressable>
  );
}

function Quiet(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={{ paddingVertical: 16, alignItems: 'center' }}
    >
      <AppText variant="body" color="inkFaint">
        {props.label}
      </AppText>
    </Pressable>
  );
}
