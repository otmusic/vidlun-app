import { DEFAULT_SETTINGS } from '@/domain/ports/ISettings';
import { SettingsStore } from '@/infrastructure/settings/SettingsStore';
import { InMemoryKeyValueStore } from './fakes';

function setup() {
  const store = new InMemoryKeyValueStore();

  return { store, subject: new SettingsStore(store) };
}

describe('SettingsStore', () => {
  it('keeps recordings on a fresh install, because that is what makes the journal work', async () => {
    const { subject } = setup();

    expect(await subject.read()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.keepRecordings).toBe(true);
  });

  it('reads back what it wrote', async () => {
    const { subject } = setup();

    await subject.write({ keepRecordings: false, locale: 'en', hasOnboarded: true });

    expect(await subject.read()).toEqual({ keepRecordings: false, locale: 'en', hasOnboarded: true });
  });

  it('falls back to defaults rather than failing on an unreadable file', async () => {
    const { store, subject } = setup();
    await store.setItem('luna.settings', 'not json');

    expect(await subject.read()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills in a setting the stored file predates', async () => {
    const { store, subject } = setup();
    await store.setItem('luna.settings', JSON.stringify({ locale: 'en' }));

    expect(await subject.read()).toEqual({ keepRecordings: true, locale: 'en', hasOnboarded: false });
  });

  it('has not onboarded anyone on a fresh install', async () => {
    const { subject } = setup();

    expect((await subject.read()).hasOnboarded).toBe(false);
  });

  it('refuses a locale it does not have', async () => {
    const { store, subject } = setup();
    await store.setItem('luna.settings', JSON.stringify({ locale: 'fr' }));

    expect((await subject.read()).locale).toBe(DEFAULT_SETTINGS.locale);
  });
});
