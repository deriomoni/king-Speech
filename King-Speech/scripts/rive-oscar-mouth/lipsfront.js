// Cool: Oscar's lips (#353) are ordered by DrawRules #362 → DrawTarget #363,
// which pointed at the glasses frame (#230). Rive draws lower object ids on
// top, and the lens glints (#213, #222) sit above the frame — so they covered
// the lips. Retarget to the topmost glint (#213), placement "before" → the
// lips draw over the whole pair of glasses.
const fs = require('fs'); const { parse } = require('./parse.js'); const D = require('./defs.json');
const [, , inp, out] = process.argv; const buf = Buffer.from(fs.readFileSync(inp)); const f = parse(buf);
const AB = f.objs.findIndex((o) => D.types[o.type] === 'Artboard');
const t = f.objs[AB + 363];
if (D.types[t.type] !== 'DrawTarget') throw 'not DrawTarget';
const q = t.props.find((p) => p.k === 119);
if (q.ve - q.vs !== 2) throw 'unexpected varuint width';
buf[q.vs] = (213 & 0x7f) | 0x80; buf[q.vs + 1] = 213 >> 7;
if (t.props.find((p) => p.k === 120)) throw 'placement already set';
fs.writeFileSync(out, buf); console.log('draw target → #213 (before)');
