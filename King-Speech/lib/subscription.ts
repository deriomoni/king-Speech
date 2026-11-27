// The player's subscription plan. Billing isn't wired yet (app/subscription.tsx
// shows «Скоро»), so the plan lives in local storage: «free» until a store
// purchase sets «royal» / «emperor». Features gated on the Royal plan (e.g.
// publishing a My Studio speech) check `hasRoyal`.
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Plan = "free" | "royal" | "emperor";
export const PLAN_KEY = "@kingspeech_plan_v1";

export async function getPlan(): Promise<Plan> {
  try {
    const v = await AsyncStorage.getItem(PLAN_KEY);
    return v === "royal" || v === "emperor" ? v : "free";
  } catch {
    return "free";
  }
}

export async function setPlan(plan: Plan): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAN_KEY, plan);
  } catch {}
}

/** Royal or higher (Emperor includes everything Royal has). */
export function useRoyalAccess(): { hasRoyal: boolean; loaded: boolean } {
  const [plan, setP] = useState<Plan | null>(null);
  useEffect(() => {
    let alive = true;
    getPlan().then((p) => alive && setP(p));
    return () => {
      alive = false;
    };
  }, []);
  return { hasRoyal: plan === "royal" || plan === "emperor", loaded: plan !== null };
}
