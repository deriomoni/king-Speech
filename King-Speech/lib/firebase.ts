import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, initializeAuth, type Auth, type Persistence } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  cfg.apiKey &&
    cfg.authDomain &&
    cfg.projectId &&
    cfg.appId &&
    cfg.storageBucket &&
    cfg.messagingSenderId,
);

export const googleClientIds = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(cfg as FirebaseOptions);

    if (Platform.OS === "web") {
      auth = getAuth(app);
    } else {
      // Firebase v12 ships `getReactNativePersistence` through the RN
      // bundle entry. Metro resolves `firebase/auth` to the RN entry on
      // native, but in some setups it can fall back to the browser/cjs
      // entry — try the inner `@firebase/auth` package as a backup.
      type RNPersistFactory = (storage: typeof AsyncStorage) => Persistence;
      let getRNPersist: RNPersistFactory | null = null;
      try {
        getRNPersist = (require("firebase/auth") as {
          getReactNativePersistence?: RNPersistFactory;
        }).getReactNativePersistence ?? null;
      } catch {}
      if (!getRNPersist) {
        try {
          getRNPersist = (require("@firebase/auth") as {
            getReactNativePersistence?: RNPersistFactory;
          }).getReactNativePersistence ?? null;
        } catch {}
      }
      try {
        if (getRNPersist) {
          auth = initializeAuth(app, { persistence: getRNPersist(AsyncStorage) });
        } else {
          console.warn(
            "[firebase] getReactNativePersistence not found — auth session will not persist across restarts.",
          );
          auth = getAuth(app);
        }
      } catch (e) {
        // initializeAuth throws if already initialized (e.g. fast refresh)
        auth = getAuth(app);
      }
    }

    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.warn("[firebase] init failed:", e);
  }
}

export { app, auth, db, storage };
