import React, { useEffect, useRef, useState } from "react";
import { Text, type TextLayoutLine } from "react-native";
import type { ReadingToken } from "@/src/speech-engine/core/text/reading";

export type { ReadingToken };
export { tokenizeReading } from "@/src/speech-engine/core/text/reading";

// ─────────────────────────────────────────────────────────────────────────────
// ReadingText — the karaoke "полотно".
//
// The ONLY thing that changes is COLOR. No pill, no border, no weight/size
// change (those shift metrics and make the text "breathe"). The CURRENT LINE
// lights up as a whole — the reader has time to read the full line — while the
// rest of the poem stays one calm readable tone.
//
// Rendering is one flat <Text> with nested <Text> per token so the natural line
// wrapping of prose/poetry is preserved (a View+flexWrap would break it). Each
// span is React.memo'd on (text, color), so advancing the line only repaints
// the spans whose line-status actually changed — silent on long poems.
// ─────────────────────────────────────────────────────────────────────────────

export interface WordColors {
  unread: string;
  read: string;
  active: string;
}

interface SpanProps {
  text: string;
  color: string;
  fontFamily?: string;
}

// ── Smooth line hand-over ───────────────────────────────────────────────────
// When the active line moves, the new line fades up to `active` and the old one
// fades down to `read` over LINE_FADE_MS instead of snapping. Only the tokens of
// those two lines get new colors per frame (Spans are memo'd), so this stays
// cheap on long texts. Nested <Text> can't take native-driven animations, hence
// a short JS tween of the color strings.
const LINE_FADE_MS = 420;

type RGBA = [number, number, number, number];
function parseColor(c: string): RGBA {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3]];
  }
  return [0, 0, 0, 1];
}
function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = parseColor(a);
  const B = parseColor(b);
  const ch = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  const al = +(A[3] + (B[3] - A[3]) * t).toFixed(3);
  return `rgba(${ch(0)},${ch(1)},${ch(2)},${al})`;
}
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/** 0→1 progress of the latest active-line change, plus the line that was active before it. */
function useLineFade(activeLine: number) {
  const [state, setState] = useState({ prev: -1, t: 1 });
  const lastLine = useRef(activeLine);
  useEffect(() => {
    if (lastLine.current === activeLine) return;
    const prev = lastLine.current;
    lastLine.current = activeLine;
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const x = Math.min(1, (Date.now() - start) / LINE_FADE_MS);
      setState({ prev, t: easeOutCubic(x) });
      if (x < 1) raf = requestAnimationFrame(step);
    };
    setState({ prev, t: 0 });
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeLine]);
  return state;
}

// Memoized so a token only repaints when its resolved color changes.
const Span = React.memo(function Span({ text, color, fontFamily }: SpanProps) {
  return <Text style={fontFamily ? { color, fontFamily } : { color }}>{text}</Text>;
});

interface Props {
  tokens: ReadingToken[];
  /** Source line currently being read. -1 = nothing lit yet (idle). */
  activeLine: number;
  colors: WordColors;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** Cap line length (≤ ~60 chars) — set by the screen, not stretched full width. */
  maxWidth?: number;
  /** Fired with the reference line array whenever text layout changes, so the
   *  screen can map the active line → a scroll offset for autoscroll. */
  onTextLayout?: (lines: TextLayoutLine[]) => void;
  align?: "left" | "center";
  /** Optional face for the CURRENT line only (Figma: Literata SemiBold). */
  activeFontFamily?: string;
}

function ReadingTextInner({
  tokens,
  activeLine,
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  maxWidth,
  onTextLayout,
  align = "left",
  activeFontFamily,
}: Props) {
  // Lines already read keep the `read` tone, the current one lights up, the
  // rest wait in `unread` (Figma 312:4346: 60% · module tint · 26%).
  const restColor = (lineIndex: number, active: number): string =>
    lineIndex === active
      ? colors.active
      : active >= 0 && lineIndex < active
        ? colors.read
        : colors.unread;
  const { prev, t } = useLineFade(activeLine);
  const colorFor = (lineIndex: number): string => {
    const target = restColor(lineIndex, activeLine);
    if (t >= 1 || (lineIndex !== activeLine && lineIndex !== prev)) return target;
    // Tween from the color this line had under the previous active line.
    return mixColor(restColor(lineIndex, prev), target, t);
  };

  return (
    <Text
      onTextLayout={
        onTextLayout ? (e) => onTextLayout(e.nativeEvent.lines) : undefined
      }
      style={{
        fontFamily,
        fontSize,
        lineHeight,
        textAlign: align,
        maxWidth,
      }}
    >
      {tokens.map((tk, i) => (
        <Span
          key={i}
          text={tk.text}
          color={colorFor(tk.lineIndex)}
          fontFamily={tk.lineIndex === activeLine ? activeFontFamily : undefined}
        />
      ))}
    </Text>
  );
}

// The whole block re-renders when currentIndex moves, but nested Spans are
// memo'd — React reconciles cheap primitive children and only the changed
// colors repaint.
const ReadingText = React.memo(ReadingTextInner);
export default ReadingText;
