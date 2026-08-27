import {
  DEFAULT_SETTINGS,
  type ISettingsStore,
  type Settings,
} from '../../domain/ports/ISettings';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.settings';

export class SettingsStore implements ISettingsStore {
  constructor(
    private readonly store: IKeyValueStore,
    /**
     * Only consulted on a first run. Once someone has settings of their own,
     * changing the phone's language must not silently change theirs back.
     */
    private readonly detect: () => Settings['locale'] = () => DEFAULT_SETTINGS.locale,
  ) {}

  async read(): Promise<Settings> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return { ...DEFAULT_SETTINGS, locale: this.detect() };
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      return merge(parsed);
    } catch {
      // Unreadable settings are not worth a failure: the defaults are a
      // working app, and the next write repairs the file.
      return DEFAULT_SETTINGS;
    }
  }

  async write(settings: Settings): Promise<void> {
    await this.store.setItem(KEY, JSON.stringify(settings));
  }
}

/** Field by field, so a setting added later reads as its default rather than undefined. */
function merge(parsed: unknown): Settings {
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_SETTINGS;
  }

  const record = parsed as Record<string, unknown>;
  const locale = record['locale'];

  return {
    keepRecordings:
      typeof record['keepRecordings'] === 'boolean'
        ? record['keepRecordings']
        : DEFAULT_SETTINGS.keepRecordings,
    locale: locale === 'en' || locale === 'uk' ? locale : DEFAULT_SETTINGS.locale,
    hasOnboarded:
      typeof record['hasOnboarded'] === 'boolean'
        ? record['hasOnboarded']
        : DEFAULT_SETTINGS.hasOnboarded,
  };
}
