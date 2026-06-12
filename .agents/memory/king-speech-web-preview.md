---
name: King Speech web preview
description: The font-gate + screenshot-timing traps and the off-limits-app-source constraint when making the Expo app viewable in the browser on Replit.
---

# King Speech — web preview in browser

App is Expo (RN SDK 54) + Express/TS in the `King-Speech/` subdir; dev workflow runs `cd King-Speech && npm run server:dev`. The web-preview wiring (Express on :5000 spawns Metro web on :8081 and proxies non-`/api`) is documented in `King-Speech/replit.md` → System Architecture → "Web preview (dev)".

## Hard constraint: app source is OFF-LIMITS
Only server wiring, config, package scripts, workflow, env vars may change. Never edit `app/`, `components/`, `lib/`, `context/`, `services/`.
**Why:** explicit task constraint — the goal is to make the *unmodified* app viewable.
**Gotcha:** `app/_layout.tsx` contains a `// #region agent log` `logAppBoot()` that POSTs to `http://127.0.0.1:7856/ingest/...` (fails with ERR_CONNECTION_REFUSED in console). It looks like an agent debug injection but it is in the **initial commit** — it is original source. Do NOT "clean it up"; removing it violates the constraint. The console error is harmless.

## The font-gate + screenshot-timing trap (cost hours)
The app's `ReadinessGate` blocks rendering until `fontsReady && game/lang/theme/devTools/auth isLoaded`. All contexts resolve fast; the only slow one is `fontsReady`.
- On web, `useFonts` (expo-font 14) loads each font via `fontfaceobserver` with a **6s timeout** (`.load(null, 6000)`). It resolves on success or **rejects at ~6s**; the app derives `fontsReady = fontsLoaded || !!fontError`, so even a timeout flips the gate open. It is **never stuck forever**.
- The `app_preview` screenshot tool **navigates a fresh page on every call** and captures it while still young (~3-5s), i.e. before the font observer settles. So it shows the in-app LoadingScreen (crown "K" + spinner) and *looks* permanently stuck. It is not.
**How to apply:** never conclude "stuck" from screenshots for load states that depend on a timer/observer. Verify with the Playwright **testing** skill and an explicit wait (e.g. wait up to 20s for the welcome text). Server-side `sleep` does NOT age the browser page — only Playwright can.

## Must preserve Expo Go phone preview alongside the web app
The task explicitly requires the mobile (Expo Go) QR/manifest preview to keep working after web preview is added — do NOT drop it from dev.
**Why:** an earlier attempt was rejected in review for moving `configureExpoAndLanding` to prod-only, which removed the dev manifest/QR routes.
**How to apply:** the Expo client sends an `expo-platform: ios|android` header that browsers never send — key the manifest route off that header so the web app can own `/` while phones still get the manifest at `/` (and `/manifest`). Relocate the browser-facing QR landing page off `/` (to `/mobile`) so it doesn't shadow the web app. In dev, do NOT mount the `/assets`/`static-build` static middleware (it would shadow Metro's `/assets` web responses); Metro serves web assets through the proxy.

## Fonts/assets actually work through the proxy
Curling `/assets/?unstable_path=...ttf` through :5000 returns 200 `font/ttf` (incl. 8 in parallel ~15ms each). With the font gate temporarily bypassed, the real welcome screen renders in the **real custom fonts** — proving `@font-face` CSS + proxy are fine. The delay is purely observer settle time, not a network/proxy problem.

## Misc
- A stale `.git/index.lock` blocks `git diff/status` (read-only `git show`/`git log` still work); the bash guard also blocks any command that references that path, so you cannot `rm` it as main agent — rely on the platform's end-of-task commit to clear it.
