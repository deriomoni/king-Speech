# iPad / tablet scaling — rules

The app is designed for phones (~390pt). On tablets everything must grow with
the screen. Mechanism (lib/responsive.ts, loaded first from index.js):

- `UI_SCALE` = min(width/390, height/844) clamped to [1, 1.5]; **exactly 1 on phones**.
- `StyleSheet.create` is patched: on tablets every numeric length in a
  stylesheet (fontSize, lineHeight, letterSpacing, width/height/min/max,
  top/left/right/bottom, padding*, margin*, gap*, borderRadius*, shadowRadius)
  is multiplied by UI_SCALE automatically. borderWidth/opacity/flex/% are not.
- `rs(n)` = n × UI_SCALE (rounded to .5) — use it for every OTHER fixed size.
- `createUnscaledStyles` = the original StyleSheet.create (no auto scaling).

## What you must fix in a file

Anything that is a fixed phone-design length but does NOT go through
StyleSheet.create stays phone-sized on iPad and breaks alignment with the
(scaled) stylesheet parts. Wrap it with `rs()`:

1. Inline style numbers: `style={{ width: 44, marginTop: 12, fontSize: 18 }}`
   → `rs(44)`, … (also inside style arrays, Animated styles' static parts).
2. Size props of components: `<Ionicons size={22}>`, `<RoundStar size={44}>`,
   `<Svg width={26} height={26}>` (NOT viewBox), `<GoldCoin size={24}>`,
   `<ActivityIndicator>` is fine, `strokeWidth` of SVG strokes that sit next to
   scaled shapes, custom components' `size`/`width`/`height` props.
3. Module-level constants used in inline styles, props, layout math, gesture
   math or animations (translateX/Y distances, offsets, row heights, radii):
   e.g. `const ROW_H = 80` used inline → use `rs(ROW_H)` at the use site.
4. Layout math that mixes window size with constants:
   `Math.min(winW, 480) - 40` → `Math.min(winW, rs(480)) - rs(40)`.
   Values derived purely from window width/height are already fine.
5. Reanimated worklets: compute `rs(...)` OUTSIDE the worklet (rs is a JS
   function) into a const, then use the const inside.

## Do NOT double-scale
If a constant is used BOTH inside `StyleSheet.create({...})` (auto-scaled) and
inline, keep the constant raw and wrap only the inline/prop/math uses with rs().
Never `const X = rs(80)` if X is also used inside a StyleSheet.create.

For complex self-consistent components (all geometry derives from a couple of
constants, lots of inline math — e.g. 3D galleries, scenes), it's cleaner to
multiply the base constant by UI_SCALE and switch that file's stylesheet to
`createUnscaledStyles(...)` (import from "@/lib/responsive"). See
components/showtime/ThemeCoverGallery.tsx for the example.

Don't scale: borderWidth/hairlines, opacity, durations, angles, colours,
percentages, flex, zIndex, counts, viewBox numbers, image asset intrinsic
sizes used as aspect ratios. Phones must render identically (UI_SCALE = 1).
