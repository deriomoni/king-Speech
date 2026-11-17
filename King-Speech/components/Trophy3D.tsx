import React, { useEffect, useRef, useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Asset } from "expo-asset";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// The victory trophy as a real 3D model (assets/models/trophy.glb, exported from
// Blender: one mesh, vertex colours, origin at the bottom of the base).
// Drawn with three.js on an expo-gl surface (works in Expo Go and on web).
//
// Motion: it spins on its base — the camera sits a little above so the top of
// the base shows — rocking a little to different sides as it turns; the spin
// winds down facing front, then it lifts up into the centre and floats there.
// ─────────────────────────────────────────────────────────────────────────────

const TROPHY_GLB = require("@/assets/models/trophy.glb");

const BRAND_GOLD = "#FFCF34";
const SPIN_SEC = 2.6; // spinning on the base
const RISE_SEC = 0.75; // lift into the centre
const TURNS = 3;
const LOW_Y = -0.035; // where it spins (model units; the model is ~0.29 tall)
const HIGH_Y = 0.02; // where it floats once it has risen

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

export default function Trophy3D({ style, delayMs = 0, fallback }: { style?: ViewStyle; delayMs?: number; fallback?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const raf = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; cancelAnimationFrame(raf.current); }, []);

  if (failed) return <View style={style}>{fallback}</View>;

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
      const camera = new THREE.PerspectiveCamera(33, w / h, 0.01, 10);
      camera.position.set(0, 0.25, 0.92);
      camera.lookAt(0, 0.085, 0);

      const geo = parseGlb(await loadBytes());
      if (!alive.current) return;
      // flat brand gold: unlit, no reflections, highlights or shading — a clean silhouette
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND_GOLD), side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      // pivot = the bottom centre of the base (the model's origin)
      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);

      let t0 = -1;
      const frame = (now: number) => {
        if (!alive.current) return;
        if (t0 < 0) t0 = now + delayMs;
        const t = Math.max(0, (now - t0) / 1000);
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
          pivot.rotation.set(0, Math.sin(s * 0.7) * 0.32, 0);
        }
        try {
          renderer.render(scene, camera);
          gl.endFrameEXP();
        } catch (e) {
          console.warn("[Trophy3D] render failed, falling back to the flat trophy:", e);
          if (alive.current) setFailed(true);
          return;
        }
        raf.current = requestAnimationFrame(frame);
      };
      raf.current = requestAnimationFrame(frame);
    } catch (e) {
      console.warn("[Trophy3D] falling back to the flat trophy:", e);
      if (alive.current) setFailed(true);
    }
  };

  return <GLView style={[{ backgroundColor: "transparent" }, style]} onContextCreate={onContextCreate} msaaSamples={4} />;
}
