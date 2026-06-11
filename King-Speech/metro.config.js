const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ignore transient/internal directories whose contents come and go (e.g.
// workflow log scratch dirs created by the dev environment). Watching them
// causes Metro to crash with ENOENT when they are removed mid-session.
config.watcher = config.watcher || {};
config.watcher.additionalExts = config.watcher.additionalExts || [];
config.watchFolders = (config.watchFolders || []).filter(
  (p) => !String(p).includes("/.local/")
);
config.resolver = config.resolver || {};
config.resolver.blockList = [
  /\/\.local\/state\/.*/,
  /\/\.local\/skills\/\.old-canvas-.*/,
];
config.resolver.assetExts = [
  ...(config.resolver.assetExts || []),
  "riv",
];

module.exports = config;
