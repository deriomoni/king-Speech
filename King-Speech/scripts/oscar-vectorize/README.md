# Oscar pose vectorizer

Turns the illustrator's Oscar PNGs into clean, layered SVG for `constants/oscarPoses.ts`.

Why pure JS: the native `vtracer` binary (`@neplex/vectorizer`) and numpy are blocked by
Windows Smart App Control on this machine, so tracing uses `potrace` (pure JS) + `sharp`.

Pipeline (`vectorize.js`):
1. Snap every pixel to a fixed palette (outline ink, pupils, mouth, tongue, gold tones, leg shade, glass, water, white).
2. Background = white touching the canvas edge (+ `bg` seed points for enclosed gaps).
3. Opening (erode→dilate) on fill colours drops anti-alias fringes; thin dark line work stripped from
   dark fills joins the outline. Small blobs are dropped.
4. Each colour is traced separately with potrace and stacked; fills grow a few px under the exact
   ink outline (no hairline gaps); the gold body is one shape with a real SVG gradient.
5. `erase` boxes remove props we redraw ourselves (heart, floor shadow); viewBox is cropped to the figure.

Usage (in a scratch folder with `npm i potrace sharp`, inputs in `in/<name>.png`):

```
V=<folder with node_modules> node run.js '{"glass":{},"chin":{"bg":[[565,1650],[1414,1356]]},
  "heart":{"erase":[[1330,460,1730,782]],"include":[[1330,460,1730,782]]},
  "lotus":{"erase":[[500,1840,1380,2010]],"bg":[[928,1334]]}}'
node gen-poses.js constants/oscarPoses.ts
```
(`run.js` just calls `run(\`in/${name}.png\`, \`out/${name}.svg\`, opts)` for each entry.)
