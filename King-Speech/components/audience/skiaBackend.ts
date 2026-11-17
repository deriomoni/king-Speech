// react-native-skia backend for the cairo-like context. Draws into a canvas
// handed out by a PictureRecorder; one picture per frame.
import {
  Skia, BlendMode, ClipOp, FillType, PaintStyle, StrokeCap, StrokeJoin, TileMode,
  type SkCanvas, type SkImage, type SkPaint, type SkPath,
} from "@shopify/react-native-skia";
import type { Backend, Cmd, Mat, RGB, Seg } from "./cairo";

const col = (c: RGB, a: number) => Skia.Color(`rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`);
const m9 = (m: Mat) => Skia.Matrix([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]);

/** dynamic paths go over JSI as one SVG string instead of a call per point */
function segPath(seg: Seg): SkPath {
  let s = "";
  for (let i = 0; i < seg.length; ) {
    const op = seg[i++];
    if (op === 0) { s += "M" + seg[i].toFixed(2) + " " + seg[i + 1].toFixed(2); i += 2; }
    else if (op === 1) { s += "L" + seg[i].toFixed(2) + " " + seg[i + 1].toFixed(2); i += 2; }
    else if (op === 2) { s += "C" + seg.slice(i, i + 6).map((v) => v.toFixed(2)).join(" "); i += 6; }
    else s += "Z";
  }
  return Skia.Path.MakeFromSVGString(s) ?? Skia.Path.Make();
}

/** cached artwork: the winding path, plus an even-odd twin made on demand (paths are immutable) */
type H = { w: SkPath; e?: SkPath };
const withRule = (p: SkPath, eo: boolean) => (eo ? Skia.PathBuilder.MakeFromPath(p).setFillType(FillType.EvenOdd).build() : p);
const ruled = (h: H, eo: boolean) => (eo ? (h.e ??= withRule(h.w, true)) : h.w);

export class SkiaBackend implements Backend<H> {
  c!: SkCanvas;
  w = 0; h = 0;
  images: Record<string, SkImage | null>;
  private fillP: SkPaint; private strokeP: SkPaint; private clearP: SkPaint; private imgP: SkPaint; private tintP: SkPaint;

  constructor(images: Record<string, SkImage | null>) {
    this.images = images;
    this.fillP = Skia.Paint(); this.fillP.setAntiAlias(true);
    this.strokeP = Skia.Paint(); this.strokeP.setAntiAlias(true); this.strokeP.setStyle(PaintStyle.Stroke);
    this.strokeP.setStrokeCap(StrokeCap.Round); this.strokeP.setStrokeJoin(StrokeJoin.Round);
    this.clearP = Skia.Paint(); this.clearP.setAntiAlias(true); this.clearP.setBlendMode(BlendMode.Clear);
    this.imgP = Skia.Paint(); this.imgP.setAntiAlias(true);
    this.tintP = Skia.Paint(); this.tintP.setAntiAlias(true);
    this.tintP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color("#0b0a0c"), BlendMode.SrcIn));
  }
  begin(c: SkCanvas, w: number, h: number) { this.c = c; this.w = w; this.h = h; }

  makePath(cmds: Cmd[], closeAtMove: boolean): H {
    const p = Skia.PathBuilder.Make(); let open = false;
    for (const k of cmds) {
      if (k.op === "M") { if (closeAtMove && open) p.close(); p.moveTo(k.p[0], k.p[1]); open = true; }
      else if (k.op === "L") p.lineTo(k.p[0], k.p[1]);
      else if (k.op === "C") p.cubicTo(k.p[0], k.p[1], k.p[2], k.p[3], k.p[4], k.p[5]);
      else p.close();
    }
    if (closeAtMove && open) p.close();
    return { w: p.build() };
  }
  private fill(p: SkPath, c: RGB, a: number, clear: boolean) {
    if (clear) { this.c.drawPath(p, this.clearP); return; }
    this.fillP.setColor(col(c, a)); this.c.drawPath(p, this.fillP);
  }
  fillDyn(seg: Seg, eo: boolean, c: RGB, a: number, clear: boolean) { this.fill(withRule(segPath(seg), eo), c, a, clear); }
  strokeDyn(seg: Seg, w: number, c: RGB, a: number) { this.strokeP.setStrokeWidth(w); this.strokeP.setColor(col(c, a)); this.c.drawPath(segPath(seg), this.strokeP); }
  fillCached(h: H, m: Mat, eo: boolean, c: RGB, a: number, clear: boolean) { this.c.save(); this.c.concat(m9(m)); this.fill(ruled(h, eo), c, a, clear); this.c.restore(); }
  strokeCached(h: H, m: Mat, w: number, c: RGB, a: number) {
    this.c.save(); this.c.concat(m9(m)); this.strokeP.setStrokeWidth(w); this.strokeP.setColor(col(c, a)); this.c.drawPath(h.w, this.strokeP); this.c.restore();
  }
  clipDyn(seg: Seg, eo: boolean) { this.c.clipPath(withRule(segPath(seg), eo), ClipOp.Intersect, true); }
  clipCached(h: H, m: Mat, eo: boolean) {
    const p = Skia.PathBuilder.MakeFromPath(h.w).transform(m9(m)).setFillType(eo ? FillType.EvenOdd : FillType.Winding).build();
    this.c.clipPath(p, ClipOp.Intersect, true);
  }
  save() { this.c.save(); }
  restore() { this.c.restore(); }
  paintRect(c: RGB, a: number) { this.fillP.setColor(col(c, a)); this.c.drawRect(Skia.XYWHRect(0, 0, this.w, this.h), this.fillP); }
  paintRadial(cx: number, cy: number, r0: number, r1: number, c0: number[], c1: number[]) {
    const p = Skia.Paint();
    p.setShader(Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, r1, [col(c0 as RGB, c0[3]), col(c0 as RGB, c0[3]), col(c1 as RGB, c1[3])], [0, Math.min(0.99, r0 / r1), 1], TileMode.Clamp));
    this.c.drawRect(Skia.XYWHRect(0, 0, this.w, this.h), p);
  }
  paintLinear(x0: number, y0: number, x1: number, y1: number, c: RGB, a0: number, a1: number) {
    const pos = [0, 0.2, 0.4, 0.6, 0.8, 1], cols = pos.map((f) => col(c, a0 + (a1 - a0) * f * f * (3 - 2 * f)));
    const p = Skia.Paint();
    p.setShader(Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, cols, pos, TileMode.Clamp));
    this.c.drawRect(Skia.XYWHRect(0, 0, this.w, this.h), p);
  }
  image(name: string, m: Mat, w: number, h: number, tint: RGB | null) {
    const img = this.images[name]; if (!img) return;
    this.c.save(); this.c.concat(m9(m));
    this.c.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, w, h), tint ? this.tintP : this.imgP);
    this.c.restore();
  }
  beginGroup(b: [number, number, number, number]) { this.c.saveLayer(undefined, Skia.XYWHRect(b[0], b[1], b[2], b[3])); }
  beginMask() { const p = Skia.Paint(); p.setBlendMode(BlendMode.DstIn); this.c.saveLayer(p); }
  endMasked() { this.c.restore(); this.c.restore(); }
  glow(m: Mat, c: RGB, a: number) {
    const p = Skia.Paint(); p.setAntiAlias(true);
    p.setShader(Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, 1, [col(c, a), col(c, a * 0.62), col(c, a * 0.18), col(c, 0)], [0, 0.35, 0.7, 1], TileMode.Clamp));
    this.c.save(); this.c.concat(m9(m)); this.c.drawCircle(0, 0, 1, p); this.c.restore();
  }
  beginLayer(alpha: number) { const p = Skia.Paint(); p.setAlphaf(alpha); this.c.saveLayer(p); }
  endLayer() { this.c.restore(); }
}
