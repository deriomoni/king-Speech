import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Premium entitlement for the Jenny Interview (paid feature).
 *
 * CURRENT: a local AsyncStorage flag — lets us build & test the paywall flow
 * before the store is set up. There is also a dev toggle (`setPremium`) so the
 * interview can be opened for review without a real purchase.
 *
 * TODO (requires App Store / Google Play products + a RevenueCat account):
 *   Replace the storage read with RevenueCat:
 *     const info = await Purchases.getCustomerInfo();
 *     setIsPremium(info.entitlements.active["jenny_interview"] !== undefined);
 *   and have `purchase()` call `Purchases.purchasePackage(...)`.
 *   The server must ALSO verify the entitlement before doing paid AI work
 *   (see the TODO in /api/tts and the interview endpoints).
 */

const PREMIUM_KEY = "@kingspeech_premium_v1";

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PREMIUM_KEY)
      .then((v) => {
        if (alive) setIsPremium(v === "1");
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Dev/local unlock toggle. Replace with a real RevenueCat purchase flow.
  const setPremium = useCallback(async (value: boolean) => {
    setIsPremium(value);
    try {
      await AsyncStorage.setItem(PREMIUM_KEY, value ? "1" : "0");
    } catch {}
  }, []);

  return { isPremium, loading, setPremium };
}
