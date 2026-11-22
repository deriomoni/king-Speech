// Hide the 3 background sparkle stars (node #53) in the Cool animation only:
// its opacity keyframes in Cool are set to 0 (float32, in place).
const fs = require('fs'); const { parse } = require('./parse.js'); const D = require('./defs.json');
const [, , inp, out] = process.argv; const buf = Buffer.from(fs.readFileSync(inp)); const f = parse(buf);
const P = (o, k) => o.props.find((q) => q.k === k);
let anim = null, kid = null, kp = null, n = 0;
for (const o of f.objs) {
  const t = D.types[o.type];
  if (t === 'LinearAnimation') anim = P(o, 55).v.toString();
  else if (t === 'KeyedObject') kid = P(o, 51).v;
  else if (t === 'KeyedProperty') kp = P(o, 53).v;
  else if (t === 'KeyFrameDouble' && anim === 'Cool' && kid === 53 && D.pname[kp] === 'WorldTransformComponent.opacity') {
    const q = P(o, 70); if (q) { buf.writeFloatLE(0, q.vs); n++; }
  }
}
fs.writeFileSync(out, buf); console.log('zeroed', n);
