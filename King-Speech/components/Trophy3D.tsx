import React, { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, View, type ViewStyle } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Asset } from "expo-asset";
import * as THREE from "three";
import { coinGeometry, coinMaterial } from "./coin3d";

// ─────────────────────────────────────────────────────────────────────────────
// The victory trophy as a real 3D model (assets/models/trophy.glb, exported from
// Blender: one mesh, vertex colours, origin at the bottom of the base).
// Drawn with three.js on an expo-gl surface (works in Expo Go and on web).
//
// Motion: it spins on its base — the camera sits a little above so the top of
// the base shows — rocking a little to different sides as it turns; the spin
// winds down facing front, then it lifts up into the centre and floats there.
// Once it has settled the player can spin it left/right with a finger (with
// a bit of momentum). Look: matte frosted yellow glass with a soft inner glow.
// The three rating stars are 3D too (puffy extruded stars, drawn in the same
// GL view with an orthographic camera below the trophy): they pop in one by
// one, then float, rock and turn a little. Lit stars are gold, unlit violet.
// Then a handful of small 3D coins (coin3d.ts) bursts out of the trophy and
// flies into the balance counter — one InstancedMesh, one draw call.
// The GL view covers the whole artboard (it ignores touches); the trophy is
// drawn into its own viewport, stars and coins with an orthographic camera in
// artboard units. Only the trophy's area takes the finger.
// ─────────────────────────────────────────────────────────────────────────────

const TROPHY_GLB = require("@/assets/models/trophy.glb");

const SPIN_SEC = 2.6; // spinning on the base
const RISE_SEC = 0.75; // lift into the centre
const TURNS = 3;
const LOW_Y = -0.035; // where it spins (model units; the model is ~0.29 tall)
const HIGH_Y = 0.0; // where it floats once it has risen (a short lift — it must stay clear of the title)

// Frosted glass with an inner glow, in sRGB: a deep amber body, lighter where
// it faces up, a pale glowing rim (fresnel) and a hot orange glow along the
// bottom edges — like light trapped inside the glass.
const GLASS_VERT = `
varying vec3 vN;
varying vec3 vV;
varying vec3 vNw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vNw = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const GLASS_FRAG = `
uniform vec3 uDeep;
uniform vec3 uBody;
uniform vec3 uRim;
uniform vec3 uUnder;
varying vec3 vN;
varying vec3 vV;
varying vec3 vNw;
void main() {
  vec3 n = normalize(vN);
  vec3 nw = normalize(vNw);
  if (!gl_FrontFacing) { n = -n; nw = -nw; }
  #ifdef ORTHO
  vec3 v = vec3(0.0, 0.0, 1.0);
  #else
  vec3 v = normalize(vV);
  #endif
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fr = pow(1.0 - ndv, 2.4);
  float up = nw.y * 0.5 + 0.5;
  // matte body: soft diffuse light from the top-left, deep amber in the shade
  float diff = max(dot(n, normalize(vec3(-0.45, 0.8, 0.6))), 0.0);
  vec3 col = mix(uDeep, uBody, clamp(0.3 + 0.6 * diff + 0.2 * up, 0.0, 1.0));
  // a faint frosted rim
  col += uRim * fr * 0.4;
  // a little warm glow left along the lower edges
  col += uUnder * fr * smoothstep(0.6, 0.05, up) * 0.8;
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

export type Star3D = {
  /** centre, artboard units */
  x: number; y: number;
  /** outer radius, artboard units */
  r: number;
  /** resting tilt, degrees */
  rot: number;
  on: boolean;
  /** seconds after mount when it pops in */
  at: number;
};

/** a five-point star with rounded tips, outer radius 1 */
function starShape() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.5 : 1;
    pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r));
  }
  const shape = new THREE.Shape();
  const k = 0.22; // how much of each edge the corner rounding eats
  pts.forEach((p, i) => {
    const prev = pts[(i + 9) % 10], next = pts[(i + 1) % 10];
    const a = p.clone().lerp(prev, k), b = p.clone().lerp(next, k);
    if (i === 0) shape.moveTo(a.x, a.y); else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.1, bevelSegments: 6, curveSegments: 6,
  });
  g.center();
  return g;
}

export type CoinFlight = {
  /** where they burst from and where they land (artboard units) */
  from: [number, number];
  to: [number, number];
  count: number;
  /** seconds after mount when the first one leaves */
  at: number;
  /** coin radius, artboard units */
  r: number;
  onArrive?: (i: number) => void;
};

const MAX_TILT = 0.32; // radians the player can tip it up/down
const RETURN_AFTER_MS = 2000;
const COIN_FLY_SEC = 1.25;
const COIN_GAP_SEC = 0.08;

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeOutBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

/** read the .glb bytes from the bundled asset */
async function loadBytes(): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(TROPHY_GLB);
  await asset.downloadAsync();
  if (Platform.OS === "web") return (await fetch(asset.uri)).arrayBuffer();
  const { File } = require("expo-file-system");
  const bytes: Uint8Array = await new File(asset.localUri ?? asset.uri).bytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** minimal GLB reader for this model: the first primitive's positions, normals, colours, indices */
function parseGlb(buf: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const jsonText = new Uint8Array(buf, 20, jsonLen).reduce((s, c) => s + String.fromCharCode(c), "");
  const j = JSON.parse(jsonText);
  const bin = 20 + jsonLen + 8;
  const comps: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i: number) => {
    const a = j.accessors[i]; const bv = j.bufferViews[a.bufferView];
    const off = bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0); const n = a.count * comps[a.type];
    if (a.componentType === 5126) return new THREE.BufferAttribute(new Float32Array(buf.slice(off, off + n * 4)), comps[a.type]);
    if (a.componentType === 5123) return new THREE.BufferAttribute(new Uint16Array(buf.slice(off, off + n * 2)), 1);
    if (a.componentType === 5125) return new THREE.BufferAttribute(new Uint32Array(buf.slice(off, off + n * 4)), 1);
    if (a.componentType === 5121) return new THREE.BufferAttribute(new Uint8Array(buf.slice(off, off + n)), comps[a.type], a.normalized);
    throw new Error("glb: unsupported component type " + a.componentType);
  };
  const prim = j.meshes[0].primitives[0];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", read(prim.attributes.POSITION));
  if (prim.attributes.NORMAL != null) g.setAttribute("normal", read(prim.attributes.NORMAL));
  else g.computeVertexNormals();
  if (prim.attributes.COLOR_0 != null) g.setAttribute("color", read(prim.attributes.COLOR_0));
  if (prim.indices != null) g.setIndex(read(prim.indices));
  return g;
}

export default function Trophy3D({
  style, k, art, trophyRect, delayMs = 0, fallback, stars = [], coins, onFail,
}: {
  style?: ViewStyle;
  /** points per artboard unit */
  k: number;
  /** artboard size [w, h] — the view covers all of it */
  art: [number, number];
  /** where the trophy is drawn: [x, y, w, h] in artboard units */
  trophyRect: [number, number, number, number];
  delayMs?: number;
  fallback?: React.ReactNode;
  stars?: Star3D[];
  coins?: CoinFlight;
  /** called if 3D can't run here (the caller can show its flat stars) */
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const raf = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current); }, []);
  // finger spin (only once the entrance is over)
  const settled = useRef(false);
  // angle: free spin left/right; tilt: a little up/down, limited; after the
  // finger lets go both ease back to the resting pose a couple of seconds later
  const drag = useRef({ active: false, angle: 0, vel: 0, sway: 1, startAngle: 0, lastX: 0, lastT: 0, tilt: 0, startTilt: 0, releasedAt: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => settled.current,
      onMoveShouldSetPanResponder: (_, g) => settled.current && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => {
        const d = drag.current; d.active = true; d.startAngle = d.angle; d.startTilt = d.tilt; d.vel = 0; d.lastX = g.dx; d.lastT = Date.now();
      },
      onPanResponderMove: (_, g) => {
        const d = drag.current; const now = Date.now();
        d.angle = d.startAngle + g.dx * 0.012;
        // up/down only a little, with a soft stop
        const raw = d.startTilt + g.dy * 0.006;
        d.tilt = Math.sign(raw) * MAX_TILT * Math.tanh(Math.abs(raw) / MAX_TILT);
        const dtm = Math.max(1, now - d.lastT);
        d.vel = ((g.dx - d.lastX) * 0.012) / (dtm / 1000);
        d.lastX = g.dx; d.lastT = now;
      },
      onPanResponderRelease: () => { const d = drag.current; d.active = false; d.vel = Math.max(-14, Math.min(14, d.vel)); d.releasedAt = Date.now(); },
      onPanResponderTerminate: () => { const d = drag.current; d.active = false; d.releasedAt = Date.now(); },
    }),
  ).current;

  const [rx, ry, rw, rh] = trophyRect;
  const box = { position: "absolute" as const, left: rx * k, top: ry * k, width: rw * k, height: rh * k };
  if (failed) return <View style={style} pointerEvents="none"><View style={box}>{fallback}</View></View>;

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const canvas: any = {
        width: w, height: h, style: {}, clientWidth: w, clientHeight: h,
        addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl,
      };
      // three ≥ r163 refuses anything that is `instanceof WebGLRenderingContext`
      // (WebGL 1). expo-gl's native context is an OpenGL ES 3 context that
      // implements WebGL 2, but it is registered under the WebGL 1 class name —
      // hide that class while the renderer checks the context.
      const g = globalThis as any;
      const webgl1 = g.WebGLRenderingContext;
      if (Platform.OS !== "web") g.WebGLRenderingContext = undefined;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, context: gl as any, alpha: true, antialias: true, premultipliedAlpha: true });
      } finally {
        if (Platform.OS !== "web") g.WebGLRenderingContext = webgl1;
      }
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      // a little above the trophy, looking down at it — the top of the base shows
      const px = w / art[0]; // buffer pixels per artboard unit
      const camera = new THREE.PerspectiveCamera(33, rw / rh, 0.01, 10);
      camera.position.set(0, 0.25, 0.92);
      camera.lookAt(0, 0.085, 0);

      const geo = parseGlb(await loadBytes());
      if (!alive.current) return;
      const rgb = (hex: string) => { const c = parseInt(hex.slice(1), 16); return new THREE.Vector3(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255); };
      const mat = new THREE.ShaderMaterial({
        vertexShader: GLASS_VERT,
        fragmentShader: GLASS_FRAG,
        uniforms: {
          uDeep: { value: rgb("#B5600A") },
          uBody: { value: rgb("#FFCF34") },
          uRim: { value: rgb("#FFF3B0") },
          uUnder: { value: rgb("#FF8A1F") },
        },
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // stars and coins: flat-on orthographic view in artboard units (y down = -y)
      const starScene = new THREE.Scene();
      const ortho = new THREE.OrthographicCamera(0, art[0], 0, -art[1], -2000, 2000);
      ortho.position.z = 1000;
      const glass = (deep: string, body: string, rim: string, under: string) => new THREE.ShaderMaterial({
        vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, defines: { ORTHO: 1 }, side: THREE.DoubleSide,
        uniforms: { uDeep: { value: rgb(deep) }, uBody: { value: rgb(body) }, uRim: { value: rgb(rim) }, uUnder: { value: rgb(under) } },
      });
      const goldStar = glass("#B5600A", "#FFCF34", "#FFF3B0", "#FF8A1F");
      const violetStar = glass("#2A0B6E", "#5A2BC4", "#B9A0FF", "#8F5CFF");
      const starGeo = starShape();
      const starMeshes = stars.map((st) => {
        const m = new THREE.Mesh(starGeo, st.on ? goldStar : violetStar);
        m.visible = false;
        starScene.add(m);
        return m;
      });
      // coins: one instanced mesh, parked at scale 0 until they fly
      const flight = coins && coins.count > 0 ? coins : null;
      const coinMesh = flight ? new THREE.InstancedMesh(coinGeometry(), coinMaterial(rgb), flight.count) : null;
      const arrived = new Array(flight?.count ?? 0).fill(false);
      const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), ce = new THREE.Euler(), cs = new THREE.Vector3(), cp = new THREE.Vector3();
      if (coinMesh) {
        coinMesh.frustumCulled = false;
        for (let i = 0; i < flight!.count; i++) coinMesh.setMatrixAt(i, cm.makeScale(0, 0, 0));
        starScene.add(coinMesh);
      }
      renderer.autoClear = false;
      let tm0 = -1;
      // pivot = the bottom centre of the base (the model's origin)
      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);

      let t0 = -1, last = -1;
      const frame = (now: number) => {
        if (!alive.current) return;
        if (t0 < 0) t0 = now + delayMs;
        if (tm0 < 0) tm0 = now;
        const tm = (now - tm0) / 1000; // since mount (the stars' clock)
        const t = Math.max(0, (now - t0) / 1000);
        const dt = last < 0 ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
        settled.current = t >= SPIN_SEC + RISE_SEC;
        if (t < SPIN_SEC) {
          // spin on the base, winding down to face front, rocking to the sides
          const p = t / SPIN_SEC;
          pivot.rotation.y = -TURNS * Math.PI * 2 * (1 - easeOutCubic(p));
          const tilt = 0.17 * (1 - p) ** 1.3;
          const dir = t * 6.5;
          pivot.rotation.x = tilt * Math.cos(dir) * 0.8;
          pivot.rotation.z = tilt * Math.sin(dir);
          pivot.position.y = LOW_Y;
          pivot.scale.setScalar(0.92 + 0.08 * easeOutCubic(Math.min(1, t / 0.5)));
        } else if (t < SPIN_SEC + RISE_SEC) {
          // lift into the centre
          const p = (t - SPIN_SEC) / RISE_SEC;
          pivot.rotation.set(0, 0, 0);
          pivot.position.y = LOW_Y + (HIGH_Y - LOW_Y) * easeOutBack(p);
          pivot.scale.setScalar(1);
        } else {
          // float: a slow bob and a gentle turn to show off the sides
          const s = t - SPIN_SEC - RISE_SEC;
          pivot.position.y = HIGH_Y + Math.sin(s * 1.6) * 0.006;
          // the player's spin: follows the finger, then coasts and slows down
          const d = drag.current;
          if (!d.active) {
            d.angle += d.vel * dt; d.vel *= Math.pow(0.04, dt);
            // a couple of seconds after letting go: settle back to the resting pose
            if (d.releasedAt && Date.now() - d.releasedAt > RETURN_AFTER_MS) {
              const home = Math.round(d.angle / (Math.PI * 2)) * Math.PI * 2; // nearest «facing front»
              const f = 1 - Math.pow(0.02, dt);
              d.angle += (home - d.angle) * f; d.tilt += (0 - d.tilt) * f; d.vel *= 0.5;
              if (Math.abs(home - d.angle) < 0.002 && Math.abs(d.tilt) < 0.002) { d.angle = 0; d.tilt = 0; d.releasedAt = 0; }
            }
          }
          // the idle sway fades out while it's being spun and comes back after
          d.sway += ((d.active || Math.abs(d.vel) > 0.3 ? 0 : 1) - d.sway) * Math.min(1, dt * 2);
          pivot.rotation.set(d.tilt, d.angle + Math.sin(s * 0.7) * 0.32 * d.sway, 0);
        }
        stars.forEach((st, i) => {
          const m = starMeshes[i];
          const p = (tm - st.at) / 0.6;
          if (p <= 0) { m.visible = false; return; }
          m.visible = true;
          const r = st.r;
          const pop = p >= 1 ? 1 : 1 + 3.2 * (p - 1) ** 3 + 2.2 * (p - 1) ** 2; // springy overshoot
          m.scale.set(r * pop, r * pop, r * pop);
          const ph = tm * ((Math.PI * 2) / (2.4 + i * 0.3)) + i * 1.3;
          m.position.set(st.x, -st.y + Math.sin(ph) * r * 0.1, 0);
          // spins in on the way, then rocks and turns a little to show its depth
          const spinIn = p < 1 ? (1 - easeOutCubic(p)) * Math.PI * 2 : 0;
          m.rotation.set(Math.sin(ph * 0.7) * 0.18, spinIn + Math.sin(ph + 0.6) * 0.42, (-st.rot * Math.PI) / 180 + Math.sin(ph + 0.8) * (st.on ? 0.12 : 0.07));
        });
        if (coinMesh && flight) {
          const [fx, fy] = flight.from, [tx, ty] = flight.to;
          for (let i = 0; i < flight.count; i++) {
            const p = (tm - flight.at - i * COIN_GAP_SEC) / COIN_FLY_SEC;
            if (p <= 0 || p >= 1) {
              coinMesh.setMatrixAt(i, cm.makeScale(0, 0, 0));
              if (p >= 1 && !arrived[i]) { arrived[i] = true; flight.onArrive?.(i); }
              continue;
            }
            // a fan: each coin pops out of the trophy to its own spot around it,
            // hangs there a moment, then swoops into the counter
            const spread = (i - (flight.count - 1) / 2) / Math.max(1, (flight.count - 1) / 2); // -1..1
            const ang = -Math.PI / 2 + spread * 1.15 + Math.sin(i * 2.3) * 0.12;
            const dist = 95 + ((i * 37) % 5) * 9;
            const bx = fx + Math.cos(ang) * dist, by = fy + Math.sin(ang) * dist * 0.8;
            let x: number, y: number;
            if (p < 0.38) {
              const e = easeOutCubic(p / 0.38);
              x = fx + (bx - fx) * e; y = fy + (by - fy) * e;
            } else {
              const q = (p - 0.38) / 0.62, e = q * q * (3 - 2 * q) ** 1;
              const cx = bx + (tx - bx) * 0.15, cy = Math.min(by, ty) - 40; // arc over
              x = (1 - e) ** 2 * bx + 2 * (1 - e) * e * cx + e * e * tx;
              y = (1 - e) ** 2 * by + 2 * (1 - e) * e * cy + e * e * ty;
            }
            const sc = flight.r * (p < 0.15 ? easeOutBack(p / 0.15) : 1 - 0.45 * Math.max(0, (p - 0.7) / 0.3));
            ce.set(0.35 + 0.25 * Math.sin(p * 6 + i), p * Math.PI * 5 + i, 0.2 * spread);
            cq.setFromEuler(ce);
            coinMesh.setMatrixAt(i, cm.compose(cp.set(x, -y, 50), cq, cs.set(sc, sc, sc)));
          }
          coinMesh.instanceMatrix.needsUpdate = true;
        }
        try {
          renderer.setViewport(0, 0, w, h);
          renderer.clear();
          renderer.setViewport(rx * px, h - (ry + rh) * px, rw * px, rh * px);
          renderer.render(scene, camera);
          if (stars.length || coinMesh) {
            renderer.setViewport(0, 0, w, h);
            renderer.clearDepth();
            renderer.render(starScene, ortho);
          }
          gl.endFrameEXP();
        } catch (e) {
          console.warn("[Trophy3D] render failed, falling back to the flat trophy:", e);
          if (alive.current) { setFailed(true); onFail?.(); }
          return;
        }
        raf.current = requestAnimationFrame(frame);
      };
      raf.current = requestAnimationFrame(frame);
    } catch (e) {
      console.warn("[Trophy3D] falling back to the flat trophy:", e);
      if (alive.current) { setFailed(true); onFail?.(); }
    }
  };

  return (
    <View style={style} pointerEvents="box-none">
      <GLView style={{ flex: 1, backgroundColor: "transparent" }} onContextCreate={onContextCreate} msaaSamples={4} pointerEvents="none" />
      <View style={box} {...pan.panHandlers} />
    </View>
  );
}
