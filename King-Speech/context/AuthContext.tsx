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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { runGameReset } from "@/lib/gameResetRegistry";
import { useLang, pickLang } from "@/context/LangContext";
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
  /** Age bracket picked at sign-up (e.g. "18-24"). */
  age?: string;
  /** Sign-up questionnaire: question id → chosen option ids. */
  survey?: Record<string, string[]>;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoaded: boolean;
  configured: boolean;
  authCancelToken: number;
  signIn: (method: AuthMethod) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Email + password: true on success, otherwise authError is set. */
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  clearAuthError: () => void;
  continueOffline: () => Promise<void>;
  saveProfile: (name: string, gender: Gender) => Promise<void>;
  /** Sign-up step 1: name + age (profile not complete until the survey). */
  saveProfileDraft: (name: string, age: string) => Promise<void>;
  /** Sign-up step 2: questionnaire answers — completes the profile. */
  saveSurvey: (answers: Record<string, string[]>) => Promise<void>;
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
  signInWithEmail: async () => false,
  signUpWithEmail: async () => false,
  resetPassword: async () => false,
  clearAuthError: () => {},
  continueOffline: async () => {},
  saveProfile: async () => {},
  saveProfileDraft: async () => {},
  saveSurvey: async () => {},
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
  // Auth errors are shown to the player (login screen Alert), so localise them.
  // A ref keeps the current language visible inside memoised callbacks.
  const { lang } = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const tx = (v: { ru: string; en: string; kk: string }) => pickLang(langRef.current, v);
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
                : fbUser.providerData[0]?.providerId === "password"
                  ? "email"
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
        setAuthError(tx({ ru: "Не удалось войти через Google. Попробуй ещё раз.", en: "Couldn't sign in with Google. Please try again.", kk: "Google арқылы кіру мүмкін болмады. Тағы байқап көріңіз." }));
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
      setAuthError(tx({ ru: "Google не вернул id_token. Проверь Client ID.", en: "Google didn't return an id_token. Check the Client ID.", kk: "Google id_token қайтармады. Client ID-ді тексеріңіз." }));
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
      setAuthError(tx({ ru: "Авторизация не настроена. Добавь Firebase-ключи в Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Secrets-ке қосыңыз." }));
      return;
    }
    const anyGoogleId =
      googleClientIds.iosClientId ||
      googleClientIds.webClientId ||
      googleClientIds.androidClientId;
    if (!anyGoogleId) {
      setAuthError(tx({ ru: "Google Sign-In не настроен. Добавь EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.", en: "Google Sign-In isn't configured. Add EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.", kk: "Google Sign-In бапталмаған. EXPO_PUBLIC_GOOGLE_*_CLIENT_ID қосыңыз." }));
      return;
    }
    try {
      await promptGoogle();
    } catch (e: any) {
      console.warn("[auth] promptGoogle failed:", e);
      setAuthError(e?.message ?? tx({ ru: "Не удалось открыть Google вход", en: "Couldn't open Google sign-in", kk: "Google арқылы кіруді ашу мүмкін болмады" }));
    }
  }, [promptGoogle]);

  const signInWithApple = useCallback(async () => {
    setAuthError(null);
    if (!firebaseConfigured || !fbAuth) {
      setAuthError(tx({ ru: "Авторизация не настроена. Добавь Firebase-ключи в Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Secrets-ке қосыңыз." }));
      return;
    }
    if (Platform.OS !== "ios") {
      setAuthError(tx({ ru: "Apple Sign-In доступен только на iOS.", en: "Apple Sign-In is only available on iOS.", kk: "Apple Sign-In тек iOS-та қолжетімді." }));
      return;
    }
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setAuthError(tx({ ru: "Apple Sign-In недоступен на этом устройстве.", en: "Apple Sign-In isn't available on this device.", kk: "Бұл құрылғыда Apple Sign-In қолжетімсіз." }));
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
        setAuthError(tx({ ru: "Apple не вернул identity token.", en: "Apple didn't return an identity token.", kk: "Apple identity token қайтармады." }));
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

  // ── Email + password (Firebase Auth) ─────────────────────────────────────
  // Firebase error codes → short, human messages in the UI language.
  const emailError = (code: string | undefined) => {
    switch (code) {
      case "auth/invalid-email":
        return tx({ ru: "Проверь email — похоже, в нём опечатка.", en: "Check the email — it looks mistyped.", kk: "Email-ді тексеріңіз — қате терілген сияқты." });
      case "auth/missing-password":
      case "auth/weak-password":
        return tx({ ru: "Пароль должен быть не короче 6 символов.", en: "The password must be at least 6 characters.", kk: "Құпиясөз кемінде 6 таңбадан тұруы керек." });
      case "auth/email-already-in-use":
        return tx({ ru: "Этот email уже зарегистрирован — просто войди.", en: "This email is already registered — just sign in.", kk: "Бұл email тіркелген — жай ғана кіріңіз." });
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return tx({ ru: "Неверный email или пароль.", en: "Wrong email or password.", kk: "Email немесе құпиясөз қате." });
      case "auth/too-many-requests":
        return tx({ ru: "Слишком много попыток. Подожди немного и попробуй снова.", en: "Too many attempts. Wait a bit and try again.", kk: "Әрекет тым көп. Біраз күтіп, қайталаңыз." });
      case "auth/network-request-failed":
        return tx({ ru: "Нет соединения с интернетом.", en: "No internet connection.", kk: "Интернет байланысы жоқ." });
      default:
        return tx({ ru: "Не удалось войти. Попробуй ещё раз.", en: "Couldn't sign in. Please try again.", kk: "Кіру мүмкін болмады. Тағы байқап көріңіз." });
    }
  };
  const notConfigured = () =>
    setAuthError(tx({ ru: "Авторизация не настроена. Добавь Firebase-ключи.", en: "Sign-in isn't configured. Add the Firebase keys.", kk: "Авторизация бапталмаған. Firebase кілттерін қосыңыз." }));

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    if (!firebaseConfigured || !fbAuth) {
      notConfigured();
      return false;
    }
    try {
      await signInWithEmailAndPassword(fbAuth, email.trim(), password);
      return true; // onAuthStateChanged loads the profile and the screen routes on
    } catch (e: any) {
      setAuthError(emailError(e?.code));
      return false;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    if (!firebaseConfigured || !fbAuth) {
      notConfigured();
      return false;
    }
    try {
      // a new account has no name yet → profile-setup asks for it
      await createUserWithEmailAndPassword(fbAuth, email.trim(), password);
      return true;
    } catch (e: any) {
      setAuthError(emailError(e?.code));
      return false;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    if (!firebaseConfigured || !fbAuth) {
      notConfigured();
      return false;
    }
    try {
      await sendPasswordResetEmail(fbAuth, email.trim());
      return true;
    } catch (e: any) {
      setAuthError(emailError(e?.code));
      return false;
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

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
      setAuthError(tx({ ru: "Этот способ входа пока не поддерживается.", en: "This sign-in method isn't supported yet.", kk: "Бұл кіру тәсіліне әзірге қолдау көрсетілмейді." }));
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

  const saveProfileDraft = useCallback(
    async (name: string, age: string) => {
      const current =
        user ??
        ({
          id: firebaseUserRef.current?.uid ?? genId(),
          name: "",
          gender: "male",
          authMethod: "email",
          profileCompleted: false,
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
        } as UserProfile);
      await persistProfile({ ...current, name, age, nameEditedByUser: true, profileCompleted: false });
    },
    [user, persistProfile],
  );

  const saveSurvey = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!user) return;
      await persistProfile({ ...user, survey: answers, profileCompleted: true });
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
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        clearAuthError,
        continueOffline,
        saveProfile,
        saveProfileDraft,
        saveSurvey,
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
