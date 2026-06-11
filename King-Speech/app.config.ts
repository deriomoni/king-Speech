import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * EAS / TestFlight config.
 * After `npx eas init`, projectId is written here automatically.
 * Until then, updates are disabled (local Expo Go still works).
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? "";

const plugins: ExpoConfig["plugins"] = [
  [
    "expo-router",
    {
      origin: process.env.EXPO_PUBLIC_API_URL
        ? new URL(process.env.EXPO_PUBLIC_API_URL).origin
        : "https://replit.com/",
    },
  ],
  "expo-font",
  "expo-web-browser",
  "expo-apple-authentication",
  [
    "expo-image-picker",
    {
      photosPermission:
        "King Speech использует доступ к фото, чтобы установить твой аватар.",
    },
  ],
  [
    "expo-speech-recognition",
    {
      microphonePermission:
        "King Speech использует микрофон для распознавания твоей речи в упражнениях.",
      speechRecognitionPermission:
        "King Speech использует распознавание речи, чтобы сверять сказанные слова со словарём.",
      androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"],
    },
  ],
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "King Speech",
  slug: "oratopath",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "oratopath",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0B1426",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.oratopath",
    usesAppleSignIn: true,
    buildNumber: "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.oratopath",
    adaptiveIcon: {
      backgroundColor: "#0B1426",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  ...(EAS_PROJECT_ID
    ? {
        updates: {
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
          enabled: true,
          checkAutomatically: "ON_LOAD",
          fallbackToCacheTimeout: 0,
        },
        runtimeVersion: {
          policy: "appVersion",
        },
      }
    : {}),
  extra: {
    ...config.extra,
    eas: {
      projectId: EAS_PROJECT_ID || undefined,
    },
  },
});
