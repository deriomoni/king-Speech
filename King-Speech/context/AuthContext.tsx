import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { runGameReset } from "@/lib/gameResetRegistry";
import {
  auth as fbAuth,
  db as fbDb,
  firebaseConfigured,
  googleClientIds,
} from "@/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

const AUTH_KEY = "@kingspeech_user";

export type Gender = "male" | "female";
export type AuthMethod = "google" | "apple" | "email";

export interface UserProfile {
  id: string;
  name: string;
  email?: string | null;
  photoURL?: string | null;
  gender: Gender;
  authMethod: AuthMethod;
  isOffline?: boolean;
  nameEditedByUser?: boolean;
  photoURLEditedByUser?: boolean;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoaded: boolean;
  configured: boolean;
  authCancelToken: number;
  signIn: (method: AuthMethod) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  continueOffline: () => Promise<void>;
  saveProfile: (name: string, gender: Gender) => Promise<void>;
  setPhotoURL: (url: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoaded: false,
  configured: false,
  authCancelToken: 0,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  continueOffline: async () => {},
  saveProfile: async () => {},
  setPhotoURL: async () => {},
  completeOnboarding: async () => {},
  signOut: async () => {},
  authError: null,
});

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function loadCached(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

async function persistCache(u: UserProfile | null) {
  if (u) await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else await AsyncStorage.removeItem(AUTH_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Bumped whenever a provider sheet is cancelled/dismissed; the login
  // screen subscribes and instantly clears its busy spinner.
  const [authCancelToken, setAuthCancelToken] = useState(0);
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  // Google auth-session hook — must be at top level. Placeholder IDs keep Expo Go
  // from crashing when Secrets are missing; signInWithGoogle still guards real IDs.
  const googlePlaceholder =
    "000000000000-dev-placeholder.apps.googleusercontent.com";
  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    iosClientId: googleClientIds.iosClientId ?? googlePlaceholder,
    androidClientId: googleClientIds.androidClientId ?? googlePlaceholder,
    webClientId: googleClientIds.webClientId ?? googlePlaceholder,
    clientId: googleClientIds.webClientId ?? googlePlaceholder,
  });

  // Bootstrap: load AsyncStorage cache immediately so offline works.
  // Then subscribe to Firebase auth state if configured.
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let mounted = true;

    (async () => {
      const cached = await loadCached();
      if (mounted && cached) setUser(cached);

      if (firebaseConfigured && fbAuth) {
        unsub = onAuthStateChanged(fbAuth, async (fbUser) => {
          firebaseUserRef.current = fbUser;
          if (!fbUser) {
            // Signed out (or never signed in). Preserve an explicit
            // offline profile across restarts — only clear cached state
            // for users that were tied to a real Firebase account.
            if (mounted) {
              setUser((prev) => {
                if (prev && !prev.isOffline) {
                  persistCache(null);
                  return null;
                }
                return prev;
              });
              setIsLoaded(true);
            }
            return;
          }

          // Pull profile doc; if missing, create shell
          let profile: UserProfile | null = null;
          try {
            if (fbDb) {
              const snap = await getDoc(doc(fbDb, "users", fbUser.uid));
              if (snap.exists()) {
                profile = snap.data() as UserProfile;
              }
            }
          } catch (e) {
            console.warn("[auth] getDoc failed:", e);
          }

          if (!profile) {
            const providerName = (fbUser.displayName ?? "").trim();
            profile = {
              id: fbUser.uid,
              name: providerName,
              email: fbUser.email,
              photoURL: fbUser.photoURL,
              gender: "male",
              authMethod: (fbUser.providerData[0]?.providerId.includes("apple")
                ? "apple"
                : "google") as AuthMethod,
              // If the provider already gave us a usable display name, treat
              // the profile as complete (gender defaults to "male" — the user
              // can change it later in Profile). This avoids forcing a manual
              // re-entry step for Google/Apple sign-ins that already supply
              // the name.
              profileCompleted: providerName.length > 0,
              onboardingCompleted: false,
              createdAt: new Date().toISOString(),
            };
            try {
              if (fbDb) {
                await setDoc(
                  doc(fbDb, "users", fbUser.uid),
                  { ...profile, updatedAt: serverTimestamp() },
                  { merge: true },
                );
              }
            } catch (e) {
              console.warn("[auth] initial setDoc failed:", e);
            }
          } else {
            // Merge fresh provider fields (name/photo can change). For
            // legacy profiles missing `profileCompleted`, infer it from
            // whether the stored name OR the provider's displayName is
            // present — this avoids forcing existing Google/Apple users
            // through the manual setup step on migration.
            const prev = profile;
            const mergedName = prev.name || fbUser.displayName || "";
            const inferredCompleted =
              prev.profileCompleted === true || mergedName.trim().length > 0;
            // Refresh provider-supplied fields (name/photo/email) when
            // the provider value is non-empty AND the stored value is
            // empty OR was the previous provider value. We never
            // overwrite a value the user explicitly edited in-app
            // (tracked by `photoURLEditedByUser` / `nameEditedByUser`).
            const providerName = (fbUser.displayName ?? "").trim();
            const providerPhoto = fbUser.photoURL ?? null;
            const providerEmail = fbUser.email ?? null;
            const refreshedName =
              !prev.nameEditedByUser && providerName.length > 0
                ? providerName
                : prev.name || providerName;
            const refreshedPhoto =
              !prev.photoURLEditedByUser && providerPhoto
                ? providerPhoto
                : prev.photoURL ?? providerPhoto;
            const merged: UserProfile = {
              ...prev,
              id: fbUser.uid,
              email: prev.email ?? providerEmail,
              photoURL: refreshedPhoto,
              name: refreshedName || mergedName,
              profileCompleted: inferredCompleted,
              onboardingCompleted: prev.onboardingCompleted ?? false,
            };
            // Persist auto-populated provider fields back to Firestore
            // so other devices see the same data without waiting for the
            // next manual profile save.
            const diff: Partial<UserProfile> = {};
            if (merged.name !== prev.name) diff.name = merged.name;
            if (merged.email !== prev.email) diff.email = merged.email;
            if (merged.photoURL !== prev.photoURL) diff.photoURL = merged.photoURL;
            if (merged.profileCompleted !== prev.profileCompleted)
              diff.profileCompleted = merged.profileCompleted;
            if (Object.keys(diff).length > 0 && fbDb) {
              try {
                await setDoc(
                  doc(fbDb, "users", fbUser.uid),
                  { ...diff, updatedAt: serverTimestamp() },
                  { merge: true },
                );
              } catch (e) {
                console.warn("[auth] provider-field merge setDoc failed:", e);
              }
            }
            profile = merged;
          }

          if (mounted) {
            setUser(profile);
            persistCache(profile);
            setIsLoaded(true);
          }
        });
      } else {
        if (mounted) setIsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  // When Google auth-session returns a result, exchange the idToken for a
  // Firebase credential. Any non-success outcome (cancel/dismiss/error)
  // also surfaces a sentinel error so the login screen can reset the busy
  // spinner — otherwise the buttons stay disabled after the user dismisses
  // the Google sheet.
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== "success") {
      if (googleResponse.type === "error") {
        setAuthError("Не удалось войти через Google. Попробуй ещё раз.");
      } else if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
        // Reset UI without showing a noisy alert. Bumping the cancel
        // token lets the login screen clear its busy spinner immediately
        // instead of waiting for the 30s safety timeout.
        setAuthError(null);
        setAuthCancelToken((n) => n + 1);
      }
      return;
    }
    const idToken = googleResponse.params?.id_token;
    if (!idToken) {
      // Provider reported success but didn't include an id_token (very
      // rare — usually a misconfigured client id or scope). Surface an
      // explicit error instead of silently leaving the button spinning
      // until the 30s safety timeout fires.
      console.warn("[auth] google success response missing id_token");
      setAuthError("Google не вернул id_token. Проверь Client ID.");
      setAuthCancelToken((n) => n + 1);
      return;
    }
    if (!fbAuth) return;
    (async () => {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(fbAuth, credential);
        setAuthError(null);
      } catch (e: any) {
        console.warn("[auth] google signInWithCredential failed:", e);
        setAuthError(e?.message ?? "Google sign-in failed");
      }
    })();
  }, [googleResponse]);

  const persistProfile = useCallback(
    async (u: UserProfile) => {
      setUser(u);
      await persistCache(u);
      if (firebaseConfigured && fbDb && firebaseUserRef.current) {
        try {
          await setDoc(
            doc(fbDb, "users", firebaseUserRef.current.uid),
            { ...u, updatedAt: serverTimestamp() },
            { merge: true },
          );
        } catch (e) {
          console.warn("[auth] persistProfile setDoc failed:", e);
        }
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!firebaseConfigured) {
      setAuthError("Авторизация не настроена. Добавь Firebase-ключи в Secrets.");
      return;
    }
    const anyGoogleId =
      googleClientIds.iosClientId ||
      googleClientIds.webClientId ||
      googleClientIds.androidClientId;
    if (!anyGoogleId) {
      setAuthError("Google Sign-In не настроен. Добавь EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.");
      return;
    }
    try {
      await promptGoogle();
    } catch (e: any) {
      console.warn("[auth] promptGoogle failed:", e);
      setAuthError(e?.message ?? "Не удалось открыть Google вход");
    }
  }, [promptGoogle]);

  const signInWithApple = useCallback(async () => {
    setAuthError(null);
    if (!firebaseConfigured || !fbAuth) {
      setAuthError("Авторизация не настроена. Добавь Firebase-ключи в Secrets.");
      return;
    }
    if (Platform.OS !== "ios") {
      setAuthError("Apple Sign-In доступен только на iOS.");
      return;
    }
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setAuthError("Apple Sign-In недоступен на этом устройстве.");
        return;
      }
      // Cryptographically-secure nonce (Apple requires unguessable values)
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!result.identityToken) {
        setAuthError("Apple не вернул identity token.");
        return;
      }
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken: result.identityToken,
        rawNonce,
      });
      const userCred = await signInWithCredential(fbAuth, credential);

      // Apple sends name only on the first sign-in — capture it.
      const fullName =
        result.fullName?.givenName || result.fullName?.familyName
          ? `${result.fullName?.givenName ?? ""} ${result.fullName?.familyName ?? ""}`.trim()
          : null;
      if (fullName && fbDb && userCred.user) {
        try {
          await setDoc(
            doc(fbDb, "users", userCred.user.uid),
            { name: fullName, updatedAt: serverTimestamp() },
            { merge: true },
          );
          // Apple only returns the user's name on the very first sign-in,
          // so we also push it into local state/cache immediately to win
          // any race with the onAuthStateChanged profile bootstrap (which
          // may have already read the doc before our write landed).
          setUser((prev) => {
            const next: UserProfile = prev
              ? { ...prev, name: fullName, profileCompleted: true }
              : {
                  id: userCred.user!.uid,
                  name: fullName,
                  email: userCred.user!.email,
                  photoURL: userCred.user!.photoURL,
                  gender: "male",
                  authMethod: "apple",
                  profileCompleted: true,
                  onboardingCompleted: false,
                  createdAt: new Date().toISOString(),
                };
            persistCache(next);
            return next;
          });
        } catch (e) {
          console.warn("[auth] apple fullName persist failed:", e);
        }
      }
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") {
        setAuthCancelToken((n) => n + 1);
        return;
      }
      console.warn("[auth] apple sign-in failed:", e);
      setAuthError(e?.message ?? "Apple sign-in failed");
    }
  }, []);

  // Offline / guest mode — used when Firebase is not configured OR the user
  // explicitly chooses to skip cloud auth. Creates a local-only profile
  // cached in AsyncStorage. GameContext continues to work entirely from
  // AsyncStorage; no cloud sync is attempted (the push effect short-circuits
  // when `fbAuth.currentUser` is null).
  const continueOffline = useCallback(async () => {
    setAuthError(null);
    if (user) return; // already have some profile (cached or signed-in)
    const offlineProfile: UserProfile = {
      id: `offline-${genId()}`,
      name: "",
      email: null,
      photoURL: null,
      gender: "male",
      authMethod: "email",
      isOffline: true,
      profileCompleted: false,
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
    };
    setUser(offlineProfile);
    await persistCache(offlineProfile);
  }, [user]);

  // Legacy `signIn(method)` — kept for backward compatibility with screens
  // that still call it. Routes to the appropriate real method.
  const signIn = useCallback(
    async (method: AuthMethod) => {
      if (method === "google") return signInWithGoogle();
      if (method === "apple") return signInWithApple();
      setAuthError("Этот способ входа пока не поддерживается.");
    },
    [signInWithGoogle, signInWithApple],
  );

  const saveProfile = useCallback(
    async (name: string, gender: Gender) => {
      const current =
        user ??
        ({
          id: firebaseUserRef.current?.uid ?? genId(),
          name: "",
          gender: "male",
          authMethod: "google",
          profileCompleted: false,
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
        } as UserProfile);
      // Mark name as user-edited so the next provider sync won't
      // silently overwrite it with the upstream Google/Apple displayName.
      await persistProfile({
        ...current,
        name,
        gender,
        nameEditedByUser: true,
        profileCompleted: true,
      });
    },
    [user, persistProfile],
  );

  const setPhotoURL = useCallback(
    async (url: string) => {
      if (!user) return;
      // Local device URIs (e.g. file://, content://, blob:) are not
      // portable across devices and must never be persisted to Firestore
      // — other devices would render a broken image. Cache them locally
      // only so the picker preview still works on this device.
      const isLocal =
        url.startsWith("file:") ||
        url.startsWith("content:") ||
        url.startsWith("blob:") ||
        url.startsWith("data:");
      // Mark photo as user-edited so the next provider sync won't
      // silently overwrite the uploaded avatar with the provider's photo.
      const next = { ...user, photoURL: url, photoURLEditedByUser: true };
      if (isLocal) {
        setUser(next);
        await persistCache(next);
      } else {
        await persistProfile(next);
      }
    },
    [user, persistProfile],
  );

  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    await persistProfile({ ...user, onboardingCompleted: true });
  }, [user, persistProfile]);

  const signOut = useCallback(async () => {
    try {
      if (firebaseConfigured && fbAuth && fbAuth.currentUser) {
        await fbSignOut(fbAuth);
      }
    } catch (e) {
      console.warn("[auth] signOut error:", e);
    }
    // Always wipe local game state on sign-out, even in offline mode where
    // there's no Firebase listener to trigger GameContext's own reset.
    try {
      await runGameReset();
    } catch (e) {
      console.warn("[auth] game reset on signOut failed:", e);
    }
    setUser(null);
    await persistCache(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        configured: firebaseConfigured,
        authCancelToken,
        signIn,
        signInWithGoogle,
        signInWithApple,
        continueOffline,
        saveProfile,
        setPhotoURL,
        completeOnboarding,
        signOut,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
