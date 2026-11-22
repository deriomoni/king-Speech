// Generic .riv parser using the file's own property table of contents.
const fs = require('fs');
function parse(buf) {
  let p = 0;
  const vu = () => { let r = 0, s = 0, b; do { b = buf[p++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80); return r; };
  if (buf.toString('latin1', 0, 4) !== 'RIVE') throw 'not rive'; p = 4;
  const major = vu(), minor = vu(), fileId = vu();
  const keys = []; for (let k; (k = vu()) !== 0;) keys.push(k);
  const types = {}; let cur = 0, bit = 8;
  for (const k of keys) { if (bit === 8) { cur = buf.readUInt32LE(p); p += 4; bit = 0; } types[k] = (cur >>> bit) & 3; bit += 2; }
  const headerEnd = p;
  const objs = [];
  while (p < buf.length) {
    const start = p; const type = vu(); const props = [];
    for (let k; (k = vu()) !== 0;) {
      const vs = p; let v;
      const t = types[k] ?? KNOWN[k];
      if (t === undefined) throw `unknown prop ${k} on type ${type} at ${p}`;
      if (t === 0) v = vu();
      else if (t === 1) { const n = vu(); v = buf.subarray(p, p + n); p += n; }
      else if (t === 2) { v = buf.readFloatLE(p); p += 4; }
      else if (t === 3) { v = buf.readUInt32LE(p); p += 4; }
      props.push({ k, t, v, vs, ve: p });
    }
    objs.push({ type, props, start, end: p });
  }
  return { major, minor, fileId, types, headerEnd, objs };
}
const D = require('./defs.json'); const KNOWN = D.props;
module.exports = { parse };
if (require.main === module) {
  const f = parse(fs.readFileSync(process.argv[2]));
  console.log('v', f.major, f.minor, 'objs', f.objs.length);
  const cnt = {}; for (const o of f.objs) cnt[o.type] = (cnt[o.type] || 0) + 1; console.log(cnt);
  f.objs.forEach((o, i) => { const nm = o.props.find(q => q.k === 4 && q.t === 1); if (nm) console.log(i, D.types[o.type]||o.type, nm.v.toString()); });
}
