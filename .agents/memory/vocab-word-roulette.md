---
name: Vocabulary word roulette (Text Scroller)
description: Why the Vocabulary level's spinning word picker was built natively instead of from the attached Lottie, and the invariant it must preserve.
---

# Vocabulary word roulette

The Vocabulary ("Словарный запас") level's word picker is a smooth vertical
"Text Scroller" reel built natively with Reanimated in
`King-Speech/app/vocabulary-level.tsx` (SpinPhase / ReelRow).

**Why not the Lottie reference:** the attached reference Lottie
(`attached_assets/List-9-16*.json`) renders its words as baked vector shapes —
there is NO editable text layer, so you cannot swap in Russian words by editing
it. Use such Lotties as a *motion reference only*; recreate the effect natively
driven by the app's own word list (`VOCAB_WORDS_RU`).

**Invariant to preserve:** the word the reel visually lands on MUST equal the
word passed to `onPicked` / played next. This is guaranteed by freezing the
finite reel array once at mount (not deriving it from a live pool), so the
parent recording the pick (which mutates `excludeIds`) can never reshuffle it
mid-spin. Keep the `stoppedRef` guard so manual STOP and the 6s auto-stop can't
both fire a landing.
