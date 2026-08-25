import {
  DEFAULT_SETTINGS,
  type ISettingsStore,
  type Settings,
} from '../../domain/ports/ISettings';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

const KEY = 'luna.settings';

export class SettingsStore implements ISettingsStore {
  constructor(private readonly store: IKeyValueStore) {}

  async read(): Promise<Settings> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return DEFAULT_SETTINGS;
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
