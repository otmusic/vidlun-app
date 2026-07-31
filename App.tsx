import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { createTranslator, DEFAULT_LOCALE } from '@/i18n';

const t = createTranslator(DEFAULT_LOCALE);

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{t('home.prompt')}</Text>
      <Text style={styles.hint}>{t('home.recordHint')}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  prompt: {
    fontSize: 25,
  },
  hint: {
    fontSize: 14,
  },
});
