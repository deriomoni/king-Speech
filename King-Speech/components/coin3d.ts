import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// The King Speech coin in 3D, built from a few simple shapes (no model file):
//   · the body — a short cylinder; its edge is reeded (ridges drawn in the shader)
//   · a raised rim ring on both faces
//   · a face plate on both faces with the crown from the logo cut out of it,
//     so the crown reads as engraved: through the cut you see the darker body
// ~2k triangles, merged into one geometry. Drawn with an InstancedMesh, so any
// number of coins costs one draw call. Coin radius 1, axis along z.
// ─────────────────────────────────────────────────────────────────────────────

/** the crown of the coin logo (components/CoinIcon.tsx), in its 897.796 box */
const CROWN = [
  [448.898, 255.564], [566.601, 456.327], [724.463, 337.23], [665.751, 640.587],
  [232.046, 640.587], [173.333, 337.23], [331.195, 456.327],
];

const RIM_OUT = 1, RIM_IN = 0.8, HALF = 0.075; // body half-thickness
const RIM_H = 0.05, PLATE_H = 0.022;

function crownPath(scale: number) {
  const c = 448.898;
  const p = new THREE.Path();
  // holes go the opposite way round to the outline
  const pts = CROWN.map(([x, y]) => new THREE.Vector2(((x - c) / c) * scale, (-(y - c) / c) * scale + 0.06)).reverse();
  p.moveTo(pts[0].x, pts[0].y);
  for (const v of pts.slice(1)) p.lineTo(v.x, v.y);
  p.closePath();
  return p;
}

type Part = { g: THREE.BufferGeometry; shade: number; mirror?: boolean };

/** merge non-indexed parts into one geometry with a per-vertex `shade` */
function merge(parts: Part[]) {
  const pos: number[] = [], nor: number[] = [], sh: number[] = [];
  for (const { g, shade, mirror } of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    if (mirror) ng.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
    const P = ng.getAttribute("position").array as ArrayLike<number>;
    const N = ng.getAttribute("normal").array as ArrayLike<number>;
    const tris = P.length / 9;
    for (let t = 0; t < tris; t++) {
      // mirroring flips the winding: swap two corners back
      const order = mirror ? [0, 2, 1] : [0, 1, 2];
      for (const v of order) {
        const o = t * 9 + v * 3;
        pos.push(P[o], P[o + 1], P[o + 2]);
        nor.push(N[o], N[o + 1], N[o + 2]);
        sh.push(shade);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("shade", new THREE.Float32BufferAttribute(sh, 1));
  return out;
}

export function coinGeometry() {
  // body
  const body = new THREE.CylinderGeometry(0.97, 0.97, HALF * 2, 40, 1);
  body.rotateX(Math.PI / 2);
  // rim ring
  const ring = new THREE.Shape();
  ring.absarc(0, 0, RIM_OUT - 0.03, 0, Math.PI * 2, false);
  const inner = new THREE.Path();
  inner.absarc(0, 0, RIM_IN, 0, Math.PI * 2, true);
  ring.holes.push(inner);
  const rim = new THREE.ExtrudeGeometry(ring, {
    depth: RIM_H, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 36,
  });
  rim.translate(0, 0, HALF);
  // face plate with the crown cut out
  const face = new THREE.Shape();
  face.absarc(0, 0, RIM_IN + 0.005, 0, Math.PI * 2, false);
  face.holes.push(crownPath(0.62));
  const plate = new THREE.ExtrudeGeometry(face, { depth: PLATE_H, bevelEnabled: false, curveSegments: 36 });
  plate.translate(0, 0, HALF);
  return merge([
    { g: body, shade: 0.74 },
    { g: rim, shade: 1.06 },
    { g: rim.clone(), shade: 1.06, mirror: true },
    { g: plate, shade: 1.0 },
    { g: plate.clone(), shade: 1.0, mirror: true },
  ]);
}

const VERT = `
attribute float shade;
varying vec3 vN;
varying vec3 vNl;
varying vec3 vPl;
varying float vShade;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 nl = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  nl = mat3(instanceMatrix) * normal;
  #endif
  vN = normalize(normalMatrix * nl);
  vNl = normal;
  vPl = position;
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;

const FRAG = `
uniform vec3 uDeep;
uniform vec3 uBody;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vNl;
varying vec3 vPl;
varying float vShade;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float diff = max(dot(n, normalize(vec3(-0.45, 0.8, 0.6))), 0.0);
  float fr = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
  vec3 col = mix(uDeep, uBody, clamp(0.45 + 0.65 * diff, 0.0, 1.0));
  col *= vShade;
  // reeded edge: fine ridges round the side of the coin
  if (abs(vNl.z) < 0.35) {
    float a = atan(vPl.y, vPl.x);
    col *= mix(0.78, 1.04, 0.5 + 0.5 * cos(a * 70.0));
  }
  col += uRim * fr * 0.3;
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

export function coinMaterial(rgb: (hex: string) => THREE.Vector3) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: { uDeep: { value: rgb("#D98A12") }, uBody: { value: rgb("#FFDA4D") }, uRim: { value: rgb("#FFF6C8") } },
  });
}
