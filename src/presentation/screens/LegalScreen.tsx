import { ScrollView, View } from 'react-native';

import type { LegalBlock, LegalDocument } from '@/i18n/legal';
import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { RoundBack } from '../components/RoundBack';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { runsOf } from './emphasis';

/**
 * The terms and the privacy policy, read inside the app rather than in a
 * browser. Apple wants these reachable from the paywall; a person deciding
 * whether to pay wants them without leaving the screen they were on.
 *
 * There is no drawing for this — the paywall in the design links to `#`. It
 * wears the chrome the statistics screen already has, deliberately: a screen
 * invented out of nothing should look like the screens that were not.
 */
export function LegalScreen(props: {
  readonly document: LegalDocument;
  readonly t: Translate;
  readonly onBack: () => void;
}): React.JSX.Element {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: 60 }}
    >
      <RoundBack t={props.t} onPress={props.onBack} />
      <AppText variant="display" style={{ marginBottom: 26 }}>
        {props.document.title}
      </AppText>
      <View style={{ gap: 16 }}>
        {props.document.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </View>
    </ScrollView>
  );
}

function Block(props: { readonly block: LegalBlock }): React.JSX.Element | null {
  const theme = useTheme();
  const { block } = props;

  if (block.heading !== undefined) {
    // The space above a section is larger than the space inside one, so the
    // document reads as parts rather than as one long column.
    return (
      <AppText variant="kicker" style={{ marginTop: 18 }}>
        {block.heading}
      </AppText>
    );
  }

  if (block.sub !== undefined) {
    return (
      <AppText variant="label" style={{ marginTop: 8 }}>
        {block.sub}
      </AppText>
    );
  }

  if (block.text !== undefined) {
    return <Sentence text={block.text} />;
  }

  if (block.bullets !== undefined) {
    return (
      <View style={{ gap: 11 }}>
        {block.bullets.map((bullet, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 6,
                marginTop: 9,
                backgroundColor: theme.palette.accent,
              }}
            />
            <View style={{ flex: 1 }}>
              <Sentence text={bullet} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (block.rows !== undefined) {
    /*
     * A table on a phone is a table nobody reads. Each row becomes the thing
     * and the things said about it, stacked, which is what the columns meant.
     */
    return (
      <View>
        {block.rows.map((row, index) => (
          <View
            key={index}
            style={{
              gap: 5,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: theme.palette.line,
            }}
          >
            <AppText variant="body">{row[0]}</AppText>
            {row.slice(1).map((cell, cellIndex) => (
              <AppText key={cellIndex} variant="secondary" color="inkSoft">
                {cell}
              </AppText>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return null;
}

function Sentence(props: { readonly text: string }): React.JSX.Element {
  return (
    <AppText variant="body" color="inkSoft">
      {runsOf(props.text).map((run, index) =>
        run.strong ? (
          /* Darker as well as heavier: on a paragraph set in inkSoft, weight
             alone is not enough of a difference to notice. */
          <AppText key={index} color="ink" style={{ fontFamily: fonts.strong }}>
            {run.text}
          </AppText>
        ) : (
          run.text
        ),
      )}
    </AppText>
  );
}
