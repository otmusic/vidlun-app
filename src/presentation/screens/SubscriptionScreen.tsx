import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';

import type { Entitlement } from '@/domain/entities/Entitlement';
import type { PurchaseOutcome } from '@/domain/ports/IPurchases';
import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { RoundBack } from '../components/RoundBack';
import { useTheme } from '../theme/ThemeProvider';

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
  readonly outcome: PurchaseOutcome | null;
  readonly t: Translate;
  readonly onSubscribe: () => void;
  readonly onRestore: () => void;
  readonly onDismissOutcome: () => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const owns = props.entitlement === 'subscribed';
  const spent = props.entitlement === 'trialSpent';

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
        ) : (
          <>
            <View style={{ marginBottom: 20, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <AppText variant="display">{t('subs.price')}</AppText>
                <AppText variant="body" color="inkSoft">
                  {t('subs.per')}
                </AppText>
              </View>
              <AppText variant="secondary" color="inkSoft">
                {/* A spent week is said out loud rather than quietly charged. */}
                {t(spent ? 'subs.priceNote' : 'subs.trialNote')}
              </AppText>
            </View>
            <Solid
              label={t(spent ? 'subs.buy' : 'subs.startTrial')}
              onPress={props.onSubscribe}
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
            <AppText variant="secondary" color="accentInk">
              {t('subs.terms')}
            </AppText>
            <AppText variant="secondary" color="accentInk">
              {t('subs.privacy')}
            </AppText>
          </View>
          <Outlined label={t('subs.notNow')} onPress={props.onBack} />
        </View>
      </ScrollView>

      <OutcomeSheet
        outcome={props.outcome}
        t={t}
        onRetry={props.onSubscribe}
        onClose={props.onDismissOutcome}
      />
    </View>
  );
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
