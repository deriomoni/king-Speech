import React from "react";
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
}

// Memoized so a token only repaints when its resolved color changes.
const Span = React.memo(function Span({ text, color }: SpanProps) {
  return <Text style={{ color }}>{text}</Text>;
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
}: Props) {
  const colorFor = (lineIndex: number): string =>
    lineIndex === activeLine ? colors.active : colors.unread;

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
        <Span key={i} text={tk.text} color={colorFor(tk.lineIndex)} />
      ))}
    </Text>
  );
}

// The whole block re-renders when currentIndex moves, but nested Spans are
// memo'd — React reconciles cheap primitive children and only the changed
// colors repaint.
const ReadingText = React.memo(ReadingTextInner);
export default ReadingText;
