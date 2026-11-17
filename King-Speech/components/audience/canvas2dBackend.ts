// HTML canvas backend for the cairo-like context (web build + offline previews).
import type { Backend, Cmd, Mat, RGB, Seg } from "./cairo";

type C2D = CanvasRenderingContext2D;
const css = (c: RGB, a: number) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

function dynPath(seg: Seg) {
  const p = new Path2D();
  for (let i = 0; i < seg.length; ) {
    const op = seg[i++];
    if (op === 0) { p.moveTo(seg[i], seg[i + 1]); i += 2; }
    else if (op === 1) { p.lineTo(seg[i], seg[i + 1]); i += 2; }
    else if (op === 2) { p.bezierCurveTo(seg[i], seg[i + 1], seg[i + 2], seg[i + 3], seg[i + 4], seg[i + 5]); i += 6; }
    else p.closePath();
  }
  return p;
}

export class Canvas2DBackend implements Backend<Path2D> {
  main: C2D; ctx: C2D; w: number; h: number;
  images: Record<string, CanvasImageSource>;
  private stack: { ctx: C2D; kind: "group" | "mask" | "layer"; alpha?: number; ox: number; oy: number }[] = [];
  /** device origin of the current target (bounded groups draw into a small canvas) */
  private ox = 0; private oy = 0; private tw = 0; private th = 0;
  private pool: HTMLCanvasElement[] = [];

  constructor(ctx: C2D, images: Record<string, CanvasImageSource>) {
    this.main = this.ctx = ctx; this.w = this.tw = ctx.canvas.width; this.h = this.th = ctx.canvas.height; this.images = images;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
  }
  makePath(cmds: Cmd[], closeAtMove: boolean) {
    const p = new Path2D(); let open = false;
    for (const c of cmds) {
      if (c.op === "M") { if (closeAtMove && open) p.closePath(); p.moveTo(c.p[0], c.p[1]); open = true; }
      else if (c.op === "L") p.lineTo(c.p[0], c.p[1]);
      else if (c.op === "C") p.bezierCurveTo(c.p[0], c.p[1], c.p[2], c.p[3], c.p[4], c.p[5]);
      else p.closePath();
    }
    if (closeAtMove && open) p.closePath();
    return p;
  }
  private id() { this.ctx.setTransform(1, 0, 0, 1, -this.ox, -this.oy); }
  private mat(m: Mat) { this.ctx.setTransform(m[0], m[1], m[2], m[3], m[4] - this.ox, m[5] - this.oy); }
  private fillWith(p: Path2D, eo: boolean, c: RGB, a: number, clear: boolean) {
    const x = this.ctx;
    if (clear) { x.save(); x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000"; x.fill(p, eo ? "evenodd" : "nonzero"); x.restore(); return; }
    x.fillStyle = css(c, a); x.fill(p, eo ? "evenodd" : "nonzero");
  }
  fillDyn(seg: Seg, eo: boolean, c: RGB, a: number, clear: boolean) { this.id(); this.fillWith(dynPath(seg), eo, c, a, clear); }
  strokeDyn(seg: Seg, w: number, c: RGB, a: number) { this.id(); const x = this.ctx; x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = css(c, a); x.stroke(dynPath(seg)); }
  fillCached(h: Path2D, m: Mat, eo: boolean, c: RGB, a: number, clear: boolean) { this.mat(m); this.fillWith(h, eo, c, a, clear); this.id(); }
  strokeCached(h: Path2D, m: Mat, w: number, c: RGB, a: number) { this.mat(m); const x = this.ctx; x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = css(c, a); x.stroke(h); this.id(); }
  clipDyn(seg: Seg, eo: boolean) { this.id(); this.ctx.clip(dynPath(seg), eo ? "evenodd" : "nonzero"); }
  clipCached(h: Path2D, m: Mat, eo: boolean) { this.mat(m); this.ctx.clip(h, eo ? "evenodd" : "nonzero"); this.id(); }
  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }
  paintRect(c: RGB, a: number) { this.id(); this.ctx.fillStyle = css(c, a); this.ctx.fillRect(this.ox, this.oy, this.tw, this.th); }
  paintRadial(cx: number, cy: number, r0: number, r1: number, c0: number[], c1: number[]) {
    this.id(); const g = this.ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0, css(c0 as RGB, c0[3])); g.addColorStop(1, css(c1 as RGB, c1[3]));
    this.ctx.fillStyle = g; this.ctx.fillRect(this.ox, this.oy, this.tw, this.th);
  }
  paintLinear(x0: number, y0: number, x1: number, y1: number, c: RGB, a0: number, a1: number) {
    this.id(); const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) g.addColorStop(f, css(c, a0 + (a1 - a0) * f * f * (3 - 2 * f)));
    this.ctx.fillStyle = g; this.ctx.fillRect(this.ox, this.oy, this.tw, this.th);
  }
  image(name: string, m: Mat, w: number, h: number, tint: RGB | null) {
    const img = this.images[name]; if (!img) return;
    this.mat(m); const x = this.ctx;
    if (tint) { x.save(); x.filter = "brightness(0)"; x.drawImage(img, 0, 0, w, h); x.restore(); } else x.drawImage(img, 0, 0, w, h);
    this.id();
  }
  private take(w: number, h: number) {
    const c = this.pool.pop() || document.createElement("canvas");
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else c.getContext("2d")!.clearRect(0, 0, w, h);
    const x = c.getContext("2d")!; x.setTransform(1, 0, 0, 1, 0, 0); x.lineCap = "round"; x.lineJoin = "round"; return x;
  }
  private push(kind: "group" | "mask" | "layer", b: [number, number, number, number], alpha?: number) {
    this.stack.push({ ctx: this.ctx, kind, alpha, ox: this.ox, oy: this.oy });
    this.ctx = this.take(Math.max(1, b[2]), Math.max(1, b[3])); this.ox = b[0]; this.oy = b[1]; this.tw = b[2]; this.th = b[3];
  }
  private pop() {
    const m = this.stack.pop()!; const child = this.ctx;
    this.ctx = m.ctx; const cx = this.ox, cy = this.oy; this.ox = m.ox; this.oy = m.oy;
    this.tw = this.stack.length ? this.tw : this.w; this.th = this.stack.length ? this.th : this.h;
    return { child, m, cx, cy };
  }
  beginGroup(b: [number, number, number, number]) { this.push("group", b); }
  beginMask() { this.push("mask", [this.ox, this.oy, this.tw, this.th]); }
  endMasked() {
    const { child: mask } = this.pop(); // back on the group content
    const content = this.ctx;
    content.save(); content.setTransform(1, 0, 0, 1, 0, 0); content.globalCompositeOperation = "destination-in"; content.drawImage(mask.canvas, 0, 0); content.restore();
    const { cx, cy } = this.pop();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.drawImage(content.canvas, cx - this.ox, cy - this.oy);
    this.pool.push(mask.canvas, content.canvas);
  }
  glow(m: Mat, c: RGB, a: number) {
    this.mat(m); const g = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, css(c, a)); g.addColorStop(0.35, css(c, a * 0.62)); g.addColorStop(0.7, css(c, a * 0.18)); g.addColorStop(1, css(c, 0));
    this.ctx.fillStyle = g; this.ctx.beginPath(); this.ctx.arc(0, 0, 1, 0, Math.PI * 2); this.ctx.fill(); this.id();
  }
  beginLayer(alpha: number) { this.push("layer", [0, 0, this.w, this.h], alpha); }
  endLayer() {
    const { child, m } = this.pop(); this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.save(); this.ctx.globalAlpha = m.alpha ?? 1; this.ctx.drawImage(child.canvas, -this.ox, -this.oy); this.ctx.restore();
    this.pool.push(child.canvas);
  }
}
