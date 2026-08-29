/**
 * Expo inlines `EXPO_PUBLIC_*` at build time, so this is the only shape of
 * `process` that exists on device. Declared here rather than pulled from
 * @types/node, which the bundler module resolution does not load.
 */
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

/**
 * The Anthropic key, for development only.
 *
 * Anything inlined into the bundle can be read out of it, so a published build
 * must not carry this: it goes through the proxy in `server/`, which holds the
 * real key and is reached with `readProxy()` below. Read directly only when no
 * proxy is configured, which is the shape of a development machine.
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

/**
 * Where the key lives in a published build. Null on a machine that has not
 * configured one, and then the app falls back to its own key — see the note on
 * `readAnthropicApiKey`. No token any more: access is proven with App Attest,
 * not with anything shipped in the bundle.
 */
export function readProxyUrl(): string | null {
  const baseUrl = process.env['EXPO_PUBLIC_API_PROXY_URL'];

  return baseUrl === undefined || baseUrl.length === 0 ? null : baseUrl;
}
