const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const EMPTY_MODULE = path.resolve(__dirname, 'metro/empty-module.js');

/**
 * The Anthropic SDK reaches for `node:fs` and friends only to discover
 * credentials on disk, and only when it was constructed without an explicit
 * api key. We always pass one, so that branch never runs on a device — but
 * Metro still has to resolve the import to finish the bundle.
 *
 * If a Node built-in ever ends up on a code path that actually executes, this
 * stub turns that into a confusing runtime failure rather than a build error.
 * That trade is deliberate and worth revisiting when the API key moves behind
 * a proxy and the SDK's credential handling stops mattering entirely.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:')) {
    return { type: 'sourceFile', filePath: EMPTY_MODULE };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
