---
name: Vocabulary word roulette (Text Scroller)
description: How/why the Vocabulary level's spinning word picker is built, its motion/font decisions, and the invariant it must preserve.
---

# Vocabulary word roulette

The Vocabulary ("Словарный запас") level's word picker (SpinPhase / ReelCol in
`King-Speech/app/vocabulary-level.tsx`) is a native Reanimated recreation of the
attached Text Scroller reference Lottie (`attached_assets/List-9-16*.json`).

**Motion:** HORIZONTAL sweep — words travel left→right, entering from the LEFT
edge, decelerating to land on the centered word. The user explicitly wanted this
(a vertical slot-reel version was rejected). Implemented by animating a shared
`pos` DOWN from near the reel end while `translateX = SCREEN_W/2 - itemW/2 -
pos*itemW`, so the strip slides right and new words appear on the left. Keep the
speed calm (~4 words/s); the user found a fast spin wrong.

**Why not the Lottie itself:** its words are baked vector shapes — there is NO
editable text and NO font metadata (`fonts` list absent). So you can't swap in
Russian words or read the original font from the file; use it as motion
reference only and drive from `VOCAB_WORDS_RU`. Current font is Fredoka_700Bold
(rounded) as a close visual match — the true reference font is unknown; if the
user names it, switch to it.

**Invariant to preserve:** the word the reel visually lands on MUST equal the
word passed to `onPicked` / played next. Guaranteed by freezing the finite reel
array once at mount (not from a live pool), so the parent recording the pick
(mutating `excludeIds`) can't reshuffle it mid-spin. Keep the `stoppedRef` guard
so manual STOP and the 6s auto-stop can't both fire a landing.
