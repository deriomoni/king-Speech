import React from "react";
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme/tokens";

// Catalogue of backgrounds for the profile plate (cover banner). The player
// doesn't upload a photo — they pick one of these: flat-vector ornaments in
// the app's palette (no outlines, soft rounded geometry, one dominant colour
// per pattern). Each pattern is drawn procedurally for any width, so it fits
// the banner on every screen and the small previews in the catalogue.

const L = colors.level;

export type CoverPatternId =
  | "crowns"
  | "mics"
  | "wave"
  | "deco"
  | "stars"
  | "confetti"
  | "curtain";

export type CoverPattern = { id: CoverPatternId; ru: string; en: string; bg: string };

export const COVER_PATTERNS: CoverPattern[] = [
  { id: "crowns", ru: "Короны", en: "Crowns", bg: L.gold },
  { id: "mics", ru: "Микрофоны", en: "Mics", bg: L.violet },
  { id: "wave", ru: "Голос", en: "Voice", bg: L.turquoise },
  { id: "deco", ru: "Ар-деко", en: "Art deco", bg: L.coral },
  { id: "stars", ru: "Звёзды сцены", en: "Stage stars", bg: "#2B2F6B" },
  { id: "confetti", ru: "Конфетти", en: "Confetti", bg: L.pink },
  { id: "curtain", ru: "Занавес", en: "Curtain", bg: "#B8323A" },
];

export const coverPatternById = (id: string | null | undefined) =>
  COVER_PATTERNS.find((p) => p.id === id) ?? null;

// Deterministic pseudo-random (same picture on every render / device).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CROWN =
  "M-9 6 L-10.5 -4.5 L-4.5 0 L0 -8 L4.5 0 L10.5 -4.5 L9 6 Z";
const SPARK = (r: number) =>
  `M0 ${-r} Q${r * 0.16} ${-r * 0.16} ${r} 0 Q${r * 0.16} ${r * 0.16} 0 ${r} ` +
  `Q${-r * 0.16} ${r * 0.16} ${-r} 0 Q${-r * 0.16} ${-r * 0.16} 0 ${-r} Z`;

function crowns(w: number, h: number) {
  const out: React.ReactNode[] = [];
  const dx = 46;
  const dy = 34;
  let k = 0;
  for (let row = 0, y = 14; y < h + 20; row++, y += dy) {
    for (let x = row % 2 ? dx / 2 : 0; x < w + dx; x += dx) {
      const big = (row + Math.round(x / dx)) % 3 === 0;
      const tone = big ? L.apricot : "#FFE58A";
      out.push(
        <G key={k++} transform={`translate(${x} ${y}) rotate(${row % 2 ? 8 : -8}) scale(${big ? 1.15 : 0.85})`}>
          <Path d={CROWN} fill={tone} />
          <Circle cx={0} cy={-8.6} r={1.9} fill={tone} />
          <Circle cx={-10.5} cy={-5} r={1.6} fill={tone} />
          <Circle cx={10.5} cy={-5} r={1.6} fill={tone} />
        </G>,
      );
    }
  }
  return out;
}

function mics(w: number, h: number) {
  const out: React.ReactNode[] = [];
  const dx = 40;
  const dy = 40;
  let k = 0;
  for (let row = 0, y = 16; y < h + 24; row++, y += dy) {
    for (let x = row % 2 ? dx / 2 : 4; x < w + dx; x += dx) {
      const c = (row + Math.round(x / dx)) % 2 ? "#B79CFF" : "#7A4FE8";
      out.push(
        <G key={k++} transform={`translate(${x} ${y}) rotate(-24)`}>
          <Rect x={-5} y={-12} width={10} height={15} rx={5} fill={c} />
          <Path
            d="M-7.5 -1 A7.5 7.5 0 0 0 7.5 -1"
            stroke={c}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Rect x={-1.3} y={6} width={2.6} height={6} rx={1.3} fill={c} />
          <Rect x={-5} y={11} width={10} height={2.6} rx={1.3} fill={c} />
        </G>,
      );
      out.push(<Circle key={k++} cx={x + dx / 2} cy={y + 2} r={1.8} fill="#C9B6FF" />);
    }
  }
  return out;
}

function wave(w: number, h: number) {
  const out: React.ReactNode[] = [];
  const step = 9;
  const bw = 5;
  let k = 0;
  const mid = h * 0.42;
  // Big voice waveform across the banner…
  for (let i = 0, x = 4; x < w; i++, x += step) {
    const env = Math.sin((x / w) * Math.PI);
    const amp =
      (0.35 + 0.65 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.23))) * env * h * 0.36 + 3;
    out.push(
      <Rect
        key={k++}
        x={x}
        y={mid - amp}
        width={bw}
        height={amp * 2}
        rx={bw / 2}
        fill={i % 4 === 0 ? "#B6F2EE" : "#26AFA9"}
      />,
    );
  }
  // …and a quiet echo of dots underneath.
  for (let x = 6; x < w; x += 18) {
    out.push(<Circle key={k++} cx={x} cy={h - 14} r={2} fill="#26AFA9" />);
  }
  return out;
}

function deco(w: number, h: number) {
  // Overlapping art-deco fans (scales), drawn top row first so each lower row
  // tucks over the previous one.
  const out: React.ReactNode[] = [];
  const R = 22;
  const dx = R * 2;
  const dy = R * 0.95;
  const rings = ["#FFB3A9", L.coral, "#FFD9D3", "#E9544A"];
  let k = 0;
  for (let row = 0, y = 0; y < h + R * 2; row++, y += dy) {
    for (let x = row % 2 ? R : 0; x < w + dx; x += dx) {
      rings.forEach((c, j) => {
        out.push(<Circle key={k++} cx={x} cy={y} r={R - j * 5.5} fill={c} />);
      });
    }
  }
  return out;
}

function stars(w: number, h: number) {
  const out: React.ReactNode[] = [];
  const r = rng(7);
  let k = 0;
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const big = r() < 0.22;
    if (big) {
      out.push(
        <Path key={k++} d={SPARK(5 + r() * 4)} transform={`translate(${x} ${y})`} fill={L.gold} />,
      );
    } else {
      out.push(
        <Circle key={k++} cx={x} cy={y} r={0.9 + r() * 1.3} fill={r() < 0.5 ? "#C9CCFF" : "#7C8CFF"} />,
      );
    }
  }
  // A soft spotlight cone from the top.
  out.push(
    <Path
      key={k++}
      d={`M${w * 0.62} 0 L${w * 0.5} ${h} L${w * 0.92} ${h} L${w * 0.7} 0 Z`}
      fill="#FFFFFF"
      opacity={0.07}
    />,
  );
  return out;
}

function confetti(w: number, h: number) {
  const out: React.ReactNode[] = [];
  const r = rng(42);
  const tones = [L.gold, "#FFFFFF", L.violet, L.mint, "#FFC2DF", L.sky];
  let k = 0;
  const n = Math.round((w * h) / 520);
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const c = tones[Math.floor(r() * tones.length)];
    const kind = r();
    const rot = Math.round(r() * 180);
    if (kind < 0.45) {
      out.push(
        <Rect key={k++} x={-6} y={-2} width={12} height={4} rx={2} fill={c} transform={`translate(${x} ${y}) rotate(${rot})`} />,
      );
    } else if (kind < 0.8) {
      out.push(<Circle key={k++} cx={x} cy={y} r={2.2 + r() * 1.6} fill={c} />);
    } else {
      out.push(
        <Path key={k++} d="M0 -4.5 L4 3 L-4 3 Z" fill={c} transform={`translate(${x} ${y}) rotate(${rot})`} />,
      );
    }
  }
  return out;
}

function curtain(w: number, h: number, uid: string) {
  const out: React.ReactNode[] = [];
  const fold = 24;
  let k = 0;
  const gid = `cvFold${uid}`;
  out.push(
    <Defs key={k++}>
      <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#7E1A22" />
        <Stop offset="0.45" stopColor="#D9464E" />
        <Stop offset="0.6" stopColor="#E35A61" />
        <Stop offset="1" stopColor="#7E1A22" />
      </LinearGradient>
    </Defs>,
  );
  for (let x = -fold / 2; x < w + fold; x += fold) {
    out.push(<Rect key={k++} x={x} y={0} width={fold} height={h} fill={`url(#${gid})`} />);
  }
  // Gold valance with scallops along the top.
  out.push(<Rect key={k++} x={0} y={0} width={w} height={14} fill={L.gold} />);
  for (let x = 0; x < w + 20; x += 20) {
    out.push(<Circle key={k++} cx={x + 10} cy={14} r={10} fill={L.gold} />);
    out.push(<Circle key={k++} cx={x + 10} cy={21} r={2.2} fill="#FFE58A" />);
  }
  return out;
}

/** The ornament for `id`, drawn into a w×h box (background not included). */
export function CoverPatternArt({
  id,
  w,
  h,
  uid,
}: {
  id: CoverPatternId;
  w: number;
  h: number;
  uid: string;
}) {
  switch (id) {
    case "crowns":
      return <>{crowns(w, h)}</>;
    case "mics":
      return <>{mics(w, h)}</>;
    case "wave":
      return <>{wave(w, h)}</>;
    case "deco":
      return <>{deco(w, h)}</>;
    case "stars":
      return <>{stars(w, h)}</>;
    case "confetti":
      return <>{confetti(w, h)}</>;
    case "curtain":
      return <>{curtain(w, h, uid)}</>;
  }
}
