---
name: Warmup pitch-game loop & scene
description: Lifecycle trap and scene model for the "Разогрев" pitch game (King-Speech/components/warmup).
---

# Warmup pitch-game loop & scene

## Loop/countdown effect must not depend on the pitch hook object
`usePitchDetection()` returns a NEW object identity every render. The warmup
game-loop / countdown `useEffect` (and any `useCallback` it depends on, e.g.
`startPlaying`/`finishGame`) must NOT list `pitch` in their deps.

**Why:** during countdown and the ~20fps playing loop the component re-renders
constantly via setState. If the effect depends on `pitch`, it re-runs on every
render, clearing its own intervals and restarting the countdown — the game never
progresses (or the loop dies after one tick).

**How to apply:** keep the latest readings in a ref (`pitchRef.current = pitch`
assigned every render) and read `pitchRef.current.{hz,range,voiceActive,
position01,startListening,stopListening}` inside the interval. Make the mount
effect depend only on stable callbacks (`startPlaying`, `clearLoops` wrapped in
`useCallback`). Store `finishGame` in a ref so the loop calls the latest
`onComplete` without making `startPlaying` unstable. Guard async resumes/timeouts
with an `aliveRef`.

## Scene model: fixed ball + scrolling world
The pitch scene pins the gold ball at a fixed x (`BALL_X_RATIO`) and scrolls the
note world left under it: `world.translateX = BALL_X - (clockSec % passSec) *
PX_PER_SEC`. Three seamless pass copies (k = -1,0,+1) wrap the loop.

**Why:** earlier the ball and notes desynced; a fixed ball + scrolling world makes
the ball visibly ride the notes and loops cleanly.

**How to apply:** all ride geometry lives in the pure, render-free
`pitchTrackGeometry.ts` (PX_PER_SEC, BALL_X_RATIO, yForOffset worklet, tooth path
cmds) so the web (Reanimated) and native (Skia) renderers stay pixel-consistent.
Keep new visual work going through that helper. Skia intentionally omits note
labels (Skia text needs a typeface) — a known, accepted web/native divergence.
