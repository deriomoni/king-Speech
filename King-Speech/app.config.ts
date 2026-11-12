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
  "expo-image",
  "expo-sharing",
  "expo-splash-screen",
  "expo-status-bar",
  "expo-video",
  // Own dev client — needed for the native face-tracking modules (no Expo Go).
  "expo-dev-client",
  [
    // Camera + mic permission texts (RU base; EN via `locales` below). Also used
    // by the expo-camera fallback path. VisionCamera v5 ships no config plugin,
    // so these strings / Android permissions come from here.
    "expo-camera",
    {
      cameraPermission:
        "King Speech использует камеру, чтобы снимать тебя в упражнениях «Роли» и подсказывать, как встать в кадр. Видео остаётся на телефоне.",
      microphonePermission:
        "King Speech использует микрофон, чтобы записывать твою речь в упражнениях.",
      recordAudioAndroid: true,
    },
  ],
  [
    // Face tracking: ML Kit FaceDetection pod needs iOS ≥ 15.5 (Expo modules
    // already require 16.4); react-native-vision-camera-face-detector needs
    // Android minSdk 26.
    "expo-build-properties",
    {
      ios: { deploymentTarget: "16.4" },
      android: { minSdkVersion: 26 },
    },
  ],
  [
    "expo-audio",
    {
      microphonePermission:
        "King Speech использует микрофон, чтобы записывать твою речь в упражнениях.",
    },
  ],
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
      // Lets iOS pick the RU/EN InfoPlist.strings from `locales` (permission texts).
      CFBundleAllowMixedLocalizations: true,
    },
    // Required-reason APIs used by React Native / Expo core. VisionCamera and
    // Google ML Kit pods ship their own PrivacyInfo.xcprivacy, which Xcode
    // merges into the app's report. Face tracking collects no data: frames are
    // processed on device and never leave the phone.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  // Localised iOS permission texts (InfoPlist.strings).
  locales: {
    ru: "./locales/ru.json",
    en: "./locales/en.json",
  },
  android: {
    package: "com.oratopath",
    permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
    adaptiveIcon: {
      backgroundColor: "#FFD857",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-foreground.png",
    },
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins,
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
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
