---
name: Oscar Rive mascot quirks
description: Real animation names in oscar.riv, the baked-in demo button, and how to verify .riv contents
---

# Oscar mascot (assets/rive/oscar.riv)

- Real timeline names (verified via runtime `rive.contents` dump): `Idle`, `Blink`, `Hi`, `ThumbUp`, `Cool`, `Happy`, `NotSure`, `Sad`, `Upset`, `Shiny`, `Bump`, `Btn*`. Single artboard `OSCAR mascot`; one `State Machine` with NO inputs.
- **Do not trust `strings file.riv`** — it surfaces phantom names like `Happy9`, `ThumbUp9`, `Idle8` that do NOT exist as playable timelines ("Animation with name Happy9 not found"). To inspect a .riv, temporarily log `JSON.stringify(rive.contents)` in RiveAnim's web branch and read the browser console.
- The artboard has a baked white background and a green "Click me" demo button in the bottom ~26%. `components/OscarMascot.tsx` handles this: renders the full square canvas, crops the bottom strip (CROP=0.74, overflow hidden), presents Oscar as a white rounded "sticker".
- **Why:** cropping is the only clean fix — the web runtime can't hide artboard nodes, and the state machine (which shows the button) has no inputs to control it.
- **How to apply:** always place Oscar via `OscarMascot` (emotion prop), never via raw RiveAnim; keep fixed pixel sizes, never scale with transforms (web transforms rasterize/blur Rive canvases — opacity-only animations).
