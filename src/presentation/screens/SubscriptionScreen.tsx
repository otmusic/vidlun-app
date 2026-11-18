import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';

import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Plan, PurchaseOutcome } from '@/domain/ports/IPurchases';
import type { Locale, Translate, TranslationKey } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { RoundBack } from '../components/RoundBack';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { planOnSale } from './planOnSale';

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
  /** Asks the store for the plans again, for when it was quiet the first time. */
  readonly onRetryPlans: () => void;
  readonly onOpenTerms: () => void;
  readonly onOpenPrivacy: () => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { t } = props;
  // Trial or paid alike: both hold the thing, and both manage it in the store.
  const owns = props.entitlement !== 'none';
  const plan = planOnSale(props.plans);

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 40 }}
      >
        <RoundBack t={t} onPress={props.onBack} />

        <AppText variant="display" style={{ marginBottom: 18 }}>
          {t('subs.title')}
        </AppText>
        <Perks t={t} />

        {owns ? (
          <>
            <View
              style={{
                borderRadius: 22,
                backgroundColor: theme.palette.limeSoft,
                padding: 22,
                gap: 8,
                marginBottom: 16,
              }}
            >
              <AppText variant="kicker">
                {t(props.entitlement === 'trial' ? 'subs.trialActive' : 'subs.manageTitle')}
              </AppText>
              <AppText variant="body" color="inkSoft">
                {t(props.entitlement === 'trial' ? 'subs.trialBody' : 'subs.manageBody')}
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
        ) : plan === undefined ? (
          /*
           * Nothing priced means the store has nothing to sell — not
           * configured, or unreachable. A card and a retry, because the
           * person did nothing wrong and may simply try later.
           */
          <>
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.palette.line,
                backgroundColor: theme.palette.paper,
                borderRadius: 22,
                padding: 22,
                gap: 8,
                marginBottom: 16,
              }}
            >
              <AppText variant="kicker">{t('subs.storeQuietTitle')}</AppText>
              <AppText variant="body" color="inkSoft">
                {t('subs.storeQuietBody')}
              </AppText>
            </View>
            <Outlined label={t('subs.storeQuietRetry')} onPress={props.onRetryPlans} />
            <Quiet label={t('subs.restore')} onPress={props.onRestore} />
          </>
        ) : (
          <>
            <PlanCard plan={plan} locale={props.locale} t={t} />
            <AppText variant="secondary" color="inkFaint" style={{ marginTop: 14, marginBottom: 14 }}>
              {noteOf(plan, t, props.locale)}
            </AppText>
            <Solid
              label={buyLabel(plan, t, props.locale)}
              onPress={() => {
                props.onSubscribe(plan.id);
              }}
            />
            <Quiet label={t('subs.restore')} onPress={props.onRestore} />
          </>
        )}

        {/* Apple asks for these to work, and someone deciding whether to pay
            is exactly who wants to read them. Nothing else follows: the way
            out is the round back button at the top. */}
        {/* Centred under the buttons, which are centred too (owner's word, 2026-11-17). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 18,
          }}
        >
          <Pressable accessibilityRole="link" onPress={props.onOpenTerms} hitSlop={10}>
            <AppText variant="secondary" color="accentInk">
              {t('subs.terms')}
            </AppText>
          </Pressable>
          {/* A separator for the eye only; each link reads on its own. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AppText variant="secondary" color="inkFaint">
              ·
            </AppText>
          </View>
          <Pressable accessibilityRole="link" onPress={props.onOpenPrivacy} hitSlop={10}>
            <AppText variant="secondary" color="accentInk">
              {t('subs.privacy')}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <OutcomeSheet
        outcome={props.outcome}
        t={t}
        onRetry={() => {
          if (plan !== undefined) {
            props.onSubscribe(plan.id);
          }
        }}
        onClose={props.onDismissOutcome}
      />
    </View>
  );
}

/** What the subscription opens, in the owner's order (2026-11-17). */
const PERKS: readonly TranslationKey[] = [
  'subs.perkJournal',
  'subs.perkEntries',
  'subs.perkAudio',
  'subs.perkMonth',
  'subs.perkPatterns',
  'subs.perkAffirmations',
];

/**
 * What the subscription gives, as a list (owner's word, 2026-11-17) rather
 * than the paragraph that mixed it with what stays free: one line a thing,
 * each behind a check in a circle, so it reads at a glance — and shown to everyone,
 * since someone who has it is reminded what they have.
 */
function Perks(props: { readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View accessibilityRole="list" style={{ gap: 12, marginBottom: 26 }}>
      {/* A label over the list, as the week's sections have, not a second heading. */}
      <AppText variant="caption" color="inkFaint">
        {props.t('subs.perksTitle')}
      </AppText>
      {PERKS.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* Each check in its own round mark (owner's word, 2026-11-17). */}
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.palette.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={15} color="accentInk" />
          </View>
          <AppText variant="body" style={{ flex: 1 }}>
            {props.t(key)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * The line under the price. With free days, it says when the charging starts
 * (owner's word, 2026-11-17): Apple asks a trial's terms to be this plain,
 * and a person deciding should not have to guess.
 */
function noteOf(plan: Plan, t: Translate, locale: Locale): string {
  if (plan.trialDays > 0) {
    return t('subs.noteTrial', {
      n: plan.trialDays,
      days: t(countedKey('subs.day', plan.trialDays, locale)),
      price: plan.price,
    });
  }

  return t('subs.noteMonthly', { price: plan.price });
}

/**
 * The month, priced by the store and never by us. One plan since 2026-10-23
 * (owner's word), so there is nothing to choose between: the card states
 * what is sold and what it costs, and the button below buys it.
 */
function PlanCard(props: {
  readonly plan: Plan;
  readonly locale: Locale;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const { plan, t } = props;

  // The free days, if the store ever gives the month some.
  const note =
    plan.trialDays > 0
      ? t('subs.trialDays', {
          n: plan.trialDays,
          days: t(countedKey('subs.day', plan.trialDays, props.locale)),
        })
      : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        borderRadius: 22,
        paddingVertical: 20,
        paddingHorizontal: 22,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="body" style={{ fontSize: 16 }}>
          {t('subs.planMonthly')}
        </AppText>
        {/* The free days stand out as a pill in the lime of the journal's count (owner's word, 2026-11-17). */}
        {note === null ? null : (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              paddingVertical: 4,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: theme.palette.limeSoft,
            }}
          >
            <AppText variant="secondary" style={{ fontWeight: '500' }}>
              {note}
            </AppText>
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <AppText variant="numeric" style={{ fontSize: 22, lineHeight: 28 }}>
          {plan.price}
        </AppText>
        <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {t('subs.perMonth')}
        </AppText>
      </View>
    </View>
  );
}

function buyLabel(plan: Plan, t: Translate, locale: Locale): string {
  if (plan.trialDays > 0) {
    return t('subs.ctaTrial', {
      n: plan.trialDays,
      days: t(countedKey('subs.day', plan.trialDays, locale)),
    });
  }

  return `${t('subs.buyFor')} ${plan.price}`;
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
  const sides = useDrawnSides();
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
      <View style={{ flex: 1, justifyContent: 'center', ...sides }}>
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
