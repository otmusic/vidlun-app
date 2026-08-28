/**
 * Expo inlines `EXPO_PUBLIC_*` at build time, so this is the only shape of
 * `process` that exists on device. Declared here rather than pulled from
 * @types/node, which the bundler module resolution does not load.
 */
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

/**
 * KNOWN DEBT, must be resolved before release.
 *
 * Because the value is inlined into the JavaScript bundle, this key ships
 * inside the app and can be extracted from it. That is acceptable while
 * developing against a throwaway key and not acceptable in a published build:
 * the fix is a thin proxy that holds the key server-side, at which point the
 * analyzer's base URL changes and nothing else does.
 */
export function readAnthropicApiKey(): string {
  const key = process.env['EXPO_PUBLIC_ANTHROPIC_API_KEY'];

  if (key === undefined || key.length === 0) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is not set. Copy .env.example to .env.');
  }

  return key;
}

/**
 * RevenueCat's public SDK key. Public by design — it identifies the app to
 * their servers and buys nothing on its own; the receipt Apple signs is what
 * grants anything. Absent means the store is not wired on this build, and the
 * app says so honestly rather than pretending to sell.
 */
export function readRevenueCatKey(): string | null {
  const key = process.env['EXPO_PUBLIC_REVENUECAT_IOS_KEY'];

  return key === undefined || key.length === 0 ? null : key;
}

/**
 * Which answer a pretend store should give, for walking the paid screens
 * before a real one is configured. Unset means no pretending: the app talks to
 * RevenueCat, or to nothing at all.
 *
 * Read only in development — see the wiring in ./container.ts.
 */
export function readFakePurchaseOutcome(): string | null {
  const scripted = process.env['EXPO_PUBLIC_FAKE_PURCHASES'];

  return scripted === undefined || scripted.length === 0 ? null : scripted;
}
