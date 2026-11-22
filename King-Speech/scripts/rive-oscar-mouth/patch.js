// Reshape Oscar's Idle mouth into the clean closed smile of the vector
// "lotus" pose: a symmetric arc, sag ≈ 0.19 of its width, one even stroke.
// Keeps the Rive mouth's own end points (so its width, position and tilt on
// the face — the portrait's proportions — stay as designed).
//
// The mouth is a closed 6-vertex path traced there and back (A→M→B, B→M→A).
// Making both passes identical gives a zero-area shape: the fill vanishes and
// only the round-capped stroke draws — an even line. End handles = 0, so no
// loops (the old blobs at the ends) form at the turn-around points.
//
// Values are float32 → patched in place; the file layout does not change.
// usage: node patch.js in.riv out.riv [sag] [handle]
const fs = require('fs');
const { parse } = require('./parse.js');
const D = require('./defs.json');
const [, , inp, out, SAG = '0.19', HAND = '0.30'] = process.argv;
const buf = Buffer.from(fs.readFileSync(inp));
const f = parse(buf);
const O = f.objs, AB = 14, END = 795;
const tn = (i) => D.types[O[i].type];
const P = (o, k) => o.props.find((q) => q.k === k);
const byId = (id) => O[AB + id];
const val = (id, k, d = 0) => { const q = P(byId(id), k); return q ? q.v : d; };

// linear map path-local → screen (mouth shape #373 inside node #352)
const th = val(373, 15), sx = val(373, 16, 1), sy = val(373, 17, 1), ny = val(352, 17, 1), nx = val(352, 16, 1);
const c = Math.cos(th), s = Math.sin(th);
const L = [[nx * c * sx, nx * -s * sy], [ny * s * sx, ny * c * sy]];
const det = L[0][0] * L[1][1] - L[0][1] * L[1][0];
const Li = [[L[1][1] / det, -L[0][1] / det], [-L[1][0] / det, L[0][0] / det]];
const mul = (M, [x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
const o = [val(374, 13), val(374, 14)]; // path offset inside the shape
const toS = (v) => mul(L, [v[0] + o[0], v[1] + o[1]]);
const toL = (p) => { const v = mul(Li, p); return [v[0] - o[0], v[1] - o[1]]; };

// current ends (A = #375, B = #377) in screen space
const A = toS([val(375, 24), val(375, 25)]), B = toS([val(377, 24), val(377, 25)]);
const ch = [B[0] - A[0], B[1] - A[1]], w = Math.hypot(...ch), d = [ch[0] / w, ch[1] / w];
let n = [-d[1], d[0]]; if (n[1] < 0) n = [-n[0], -n[1]]; // perpendicular pointing down (screen y+)
const M = [(A[0] + B[0]) / 2 + n[0] * w * +SAG, (A[1] + B[1]) / 2 + n[1] * w * +SAG];
const h = w * +HAND;
const dirL = (sv) => { const v = mul(Li, sv); return [Math.atan2(v[1], v[0]), Math.hypot(...v)]; };
const [rotFwd, distMid] = dirL([d[0] * h, d[1] * h]);
const rotBack = rotFwd > 0 ? rotFwd - Math.PI : rotFwd + Math.PI;
const Al = toL(A), Bl = toL(B), Ml = toL(M);
const target = {
  375: { 24: Al[0], 25: Al[1], 82: 0, 83: 0 },
  376: { 24: Ml[0], 25: Ml[1], 82: rotFwd, 83: distMid },
  377: { 24: Bl[0], 25: Bl[1], 82: 0, 83: 0 },
  378: { 24: Bl[0], 25: Bl[1], 82: 0, 83: 0 },
  379: { 24: Ml[0], 25: Ml[1], 82: rotBack, 83: distMid },
  380: { 24: Al[0], 25: Al[1], 82: 0, 83: 0 },
};
console.log('screen A', A.map((v) => v.toFixed(2)), 'B', B.map((v) => v.toFixed(2)), 'w', w.toFixed(2), 'M', M.map((v) => v.toFixed(2)));

let n1 = 0, n2 = 0;
// base values
for (const [id, kv] of Object.entries(target)) for (const [k, v] of Object.entries(kv)) {
  const q = P(byId(+id), +k);
  if (q) { buf.writeFloatLE(v, q.vs); n1++; } else if (Math.abs(v) > 1e-6) console.warn('base prop missing', id, k);
}
// Idle keyframes
let anim = null, kid = null, kprop = null;
for (let i = 0; i < O.length; i++) {
  const t = tn(i), ob = O[i];
  if (t === 'LinearAnimation') anim = P(ob, 55).v.toString();
  else if (t === 'KeyedObject') kid = P(ob, 51).v;
  else if (t === 'KeyedProperty') kprop = P(ob, 53).v;
  else if (t === 'KeyFrameDouble' && anim === 'Idle' && target[kid] && target[kid][kprop] !== undefined) {
    const q = P(ob, 70);
    if (q) { buf.writeFloatLE(target[kid][kprop], q.vs); n2++; } else console.warn('kf without value (0)', kid, kprop);
  }
}
// stroke thickness (Idle) — a touch lighter, closer to the vector smile
const THICK = +(process.argv[6] ?? 5);
{
  let anim = null, kid = null, kprop = null;
  for (let i = 0; i < O.length; i++) {
    const t = tn(i), ob = O[i];
    if (t === 'LinearAnimation') anim = P(ob, 55).v.toString();
    else if (t === 'KeyedObject') kid = P(ob, 51).v;
    else if (t === 'KeyedProperty') kprop = P(ob, 53).v;
    else if (t === 'KeyFrameDouble' && anim === 'Idle' && kid === 742 && kprop === 47) { buf.writeFloatLE(THICK, P(ob, 70).vs); n2++; }
  }
  buf.writeFloatLE(THICK, P(byId(742), 47).vs); n1++;
}
// round join on the mouth stroke: the path is closed (no caps), so the ends
// are joins — round ones give the soft ends of the vector smile.
const so = byId(742);
let outBuf = buf;
if (!P(so, 49)) {
  const at = so.end - 1; // the object's terminating 0
  outBuf = Buffer.concat([buf.subarray(0, at), Buffer.from([49, 1]), buf.subarray(at)]);
} else outBuf[P(so, 49).vs] = 1;
fs.writeFileSync(out, outBuf);
console.log('patched base', n1, 'idle keyframes', n2);
