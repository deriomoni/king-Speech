---
name: Interview tab hosts Cheat Sheet
description: The "interview" tab slot was repurposed from Jenny interview to the offline «Шпаргалка» prep feature; portal-interview is unrelated.
---

The bottom-tab slot with route name `interview` (`app/(tabs)/interview.tsx`) no
longer contains the Jenny AI interview studio. It now hosts «Шпаргалка» (Cheat
Sheet) — a fully offline, static, guided pre-performance prep mode (breathing,
chants, tongue twisters, tips/quick-fixes, final anchor) with a time-based entry
(2/5/10 min routes) and a "Полная версия" reference. Content lives in
`constants/cheatsheetData.ts`; UI in `components/cheatsheet/`.

**Why:** The route name was intentionally kept as `interview` (not renamed to
`cheatsheet`) to avoid touching expo-router registration and any router refs.
So the file/route name and the feature name deliberately diverge.

**How to apply:** When someone mentions the "interview tab" or Jenny, remember:
- The *tab* = Cheat Sheet (offline, no AI).
- `app/portal-interview.tsx` is a SEPARATE rank-up boss mechanic that still uses
  Jenny — leave it intact; it is not "on this slot".
