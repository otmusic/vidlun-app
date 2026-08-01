/**
 * The AsyncStorage surface the repositories use. Injected so that persistence
 * can be tested in plain Node without a native mock.
 */
export interface IKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
}
