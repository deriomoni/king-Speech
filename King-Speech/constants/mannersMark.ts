// Geometry of the «Королевские манеры» mark: the King Speech app crown
// (constants/crownPath.ts, 48.3 × 39 units) with a bow tie under it. The bow
// is two mirrored triangles meeting at a single centre point — no knot, no
// seams — drawn as ONE path so it renders as one solid shape. Corners are
// softened by stroking the path with the fill colour (round joins).
import { CROWN_PATH } from "@/constants/crownPath";

export const CROWN = CROWN_PATH;

const CX = 24.13; // crown axis (centre ball)
const CROWN_BOTTOM = 38.85; // lowest point of the crown's rounded bottom
export const GAP = 5.1; // crown ↔ bow
const BOW_HALF_W = 14.6; // centre → wing tip
const BOW_HALF_H = 5.9; // half height of a wing at its outer edge
export const BOW_MID = CROWN_BOTTOM + GAP + BOW_HALF_H;

const L = CX - BOW_HALF_W;
const R = CX + BOW_HALF_W;
export const BOW = [
  `M ${CX} ${BOW_MID}`,
  `L ${L} ${BOW_MID - BOW_HALF_H}`,
  `L ${L} ${BOW_MID + BOW_HALF_H}`,
  "Z",
  `M ${CX} ${BOW_MID}`,
  `L ${R} ${BOW_MID - BOW_HALF_H}`,
  `L ${R} ${BOW_MID + BOW_HALF_H}`,
  "Z",
].join(" ");

/** Width of the round-join stroke that softens the bow corners (view-box units). */
export const SOFTEN = 4;

// View box: crown 0…48.3 wide; a little air for the softening stroke.
const PAD = 1.4;
export const VB_X = -PAD;
export const VB_Y = -PAD;
export const VB_W = 48.3 + PAD * 2;
export const VB_H = +(BOW_MID + BOW_HALF_H + SOFTEN / 2 + PAD * 2).toFixed(2);
export const MANNERS_MARK_RATIO = VB_W / VB_H; // width / height

/** Same mark as a standalone SVG string (for export). */
export function mannersMarkSvg(color = "#262628"): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB_X} ${VB_Y} ${VB_W} ${VB_H}">`,
    `<path d="${CROWN}" fill="${color}"/>`,
    `<path d="${BOW}" fill="${color}" stroke="${color}" stroke-width="${SOFTEN}" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("\n");
}
