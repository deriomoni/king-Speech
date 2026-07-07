---
name: RN-web transform rasterization blur
description: Why animations on the Path tab (and RN-web generally in this app) must be opacity-only
---

Rule: In this Expo web app, avoid animated `scale`/`translate`/`rotate`/`perspective` transforms on content tiles and rows; animate `opacity` only.

**Why:** On react-native-web, transform animations rasterize the element's layer; after springs settle the tile can stay blurry/pixelated (user reported "растрируется и пикселизуется" on level press). Per-row geometric transforms also visually disconnected the SVG snake thread between Path tiles and caused scroll lag with hundreds of rows. The user explicitly requires the thread to look connected "absolutely always".

**How to apply:** For press feedback use `Pressable`'s `pressed` state with an opacity dim. For scroll-edge and entry effects use opacity-only `useAnimatedStyle`. If a depth/perspective look is requested again, warn about these tradeoffs first.
