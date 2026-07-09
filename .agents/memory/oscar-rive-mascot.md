---
name: Oscar Rive mascot quirks
description: Real animation names in oscar.riv, transparent background history, and how to verify .riv contents
---

# Oscar mascot (assets/rive/oscar.riv)

- Real timeline names (verified via runtime `rive.contents` dump): `Idle`, `Blink`, `Hi`, `ThumbUp`, `Cool`, `Happy`, `NotSure`, `Sad`, `Upset`, `Shiny`, `Bump`, `Btn*`. Single artboard `OSCAR mascot`; one `State Machine` with NO inputs.
- **Do not trust `strings file.riv`** — it surfaces phantom names like `Happy9`, `ThumbUp9` that do NOT exist as playable timelines ("Animation with name Happy9 not found"). To inspect a .riv, temporarily log `JSON.stringify(rive.contents)` in RiveAnim's web branch and read the browser console.
- Background: the original export had a baked-in white background shape (runtimes DO draw it; canvas chroma-keying via the `advance` event worked pixel-wise but the designer fixed the source instead). The current oscar.riv (July 2026) has a transparent background — no keying or white card needed.
- The artboard still has a demo "Click me" button zone in the bottom ~26%. `components/OscarMascot.tsx` crops it (CROP=0.74, overflow hidden).
- **How to apply:** always place Oscar via `OscarMascot` (emotion prop), never via raw RiveAnim; keep fixed pixel sizes, never scale with transforms (web transforms rasterize/blur Rive canvases — opacity-only animations).
- If a new oscar.riv is delivered, re-verify: animation names, background transparency, and whether the button strip is still present (crop may become unnecessary).
