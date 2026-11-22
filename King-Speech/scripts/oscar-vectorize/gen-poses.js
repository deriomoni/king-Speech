const fs = require('fs');
const names = ['glass', 'wink', 'chin', 'heart', 'lotus'];
let out = `// Oscar poses for the Get Ready tip cards — vectorized from the illustrator's
// PNGs (potrace, layer by layer: palette-snapped fills tucked under an exact
// ink outline, gold body as a real gradient). Each entry is a self-contained
// SVG; \`box\` is its viewBox [x, y, w, h]. The heart pose has no heart —
// TipMascot draws and animates its own. Generated file — do not edit by hand.

export type OscarPose = ${names.map((n) => JSON.stringify(n)).join(' | ')};

export const OSCAR_POSES: Record<OscarPose, { box: [number, number, number, number]; xml: string }> = {
`;
for (const n of names) {
  let s = fs.readFileSync(`out/${n}.svg`, 'utf8');
  s = s.replace(/-?\d+\.\d+/g, (m) => (Math.round(parseFloat(m) * 10) / 10).toString()).replace(/\n/g, '');
  s = s.replace(/oscarGold/g, `oscarGold_${n}`);
  const vb = s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  out += `  ${n}: {\n    box: [${vb.join(', ')}],\n    xml: ${JSON.stringify(s)},\n  },\n`;
}
out += '};\n';
fs.writeFileSync(process.argv[2], out);
console.log(Math.round(out.length / 1024) + 'KB');
