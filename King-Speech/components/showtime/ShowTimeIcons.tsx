// Show Time tab icons — paths taken 1:1 from the Figma assets in
// assets/figma/showtime/*.svg (Screen / 03b · Show Time — full, node 17:660),
// rebuilt as react-native-svg components so the colour follows the theme.
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

type IconProps = { color: string; size?: number };

export function CaretBackIcon({ color }: IconProps) {
  return (
    <Svg width={28} height={32} viewBox="0 0 28 32" fill="none">
      <Path
        d="M17.99 7.11C18.25 7.00333 18.5233 6.98667 18.81 7.06C19.1033 7.13333 19.3233 7.28 19.47 7.5C19.65 7.71333 19.75 8.11333 19.77 8.7C19.79 9.28 19.8 11.74 19.8 16.08L19.74 23.9L19.69 24.12C19.5033 24.4467 19.2467 24.6833 18.92 24.83C18.5933 24.9767 18.2667 24.9767 17.94 24.83C17.7933 24.7567 16.18 23.4 13.1 20.76C10.02 18.1133 8.44333 16.7 8.37 16.52C8.18333 16.1533 8.18333 15.79 8.37 15.43C8.44333 15.2433 10.02 13.83 13.1 11.19C16.18 8.54333 17.81 7.18333 17.99 7.11Z"
        fill={color}
      />
    </Svg>
  );
}

export function CaretForwardIcon({ color }: IconProps) {
  return (
    <Svg width={28} height={32} viewBox="0 0 28 32" fill="none">
      <Path
        d="M9.13 7.11C9.46333 6.96333 9.79333 6.98333 10.12 7.17C10.2667 7.24333 11.87 8.59 14.93 11.21C17.99 13.8367 19.5567 15.2433 19.63 15.43C19.8167 15.79 19.8167 16.1533 19.63 16.52C19.5567 16.7 17.98 18.1133 14.9 20.76C11.82 23.4 10.2067 24.7467 10.06 24.8C9.91333 24.86 9.73333 24.89 9.52 24.89C8.86 24.89 8.44 24.58 8.26 23.96C8.22 23.8133 8.2 21.1133 8.2 15.86L8.26 8.04L8.37 7.77C8.51667 7.44333 8.77 7.22333 9.13 7.11Z"
        fill={color}
      />
    </Svg>
  );
}

export function ChevronForwardIcon({ color }: IconProps) {
  return (
    <Svg width={22} height={24} viewBox="0 0 22 24" fill="none">
      <Path
        d="M7.69 4.8C7.92333 4.74667 8.15333 4.77667 8.38 4.89C8.46667 4.91667 9.58333 6.00333 11.73 8.15C13.5033 9.90333 14.5133 10.9233 14.76 11.21C15.0067 11.49 15.13 11.7467 15.13 11.98C15.13 12.2067 15.0067 12.4633 14.76 12.75C14.5133 13.0367 13.5033 14.0533 11.73 15.8C10.01 17.52 9.00667 18.51 8.72 18.77C8.43333 19.0233 8.19 19.1667 7.99 19.2C7.73667 19.2267 7.5 19.1533 7.28 18.98C7.06667 18.8067 6.94667 18.5933 6.92 18.34C6.86 18.1067 6.88667 17.89 7 17.69C7.03333 17.6033 7.98 16.63 9.84 14.77L12.63 11.98L9.84 9.19C7.98 7.32333 7.03333 6.34667 7 6.26C6.88667 6.06 6.86 5.84667 6.92 5.62C6.97333 5.16 7.23 4.88667 7.69 4.8Z"
        fill={color}
      />
    </Svg>
  );
}

export function PlayCircleIcon({ color }: IconProps) {
  return (
    <Svg width={22} height={24} viewBox="0 0 22 24" fill="none">
      <Path
        d="M10.4 3.08C12.4067 2.94 14.24 3.41333 15.9 4.5C16.3867 4.84667 16.86 5.25 17.32 5.71C18.7467 7.11 19.6033 8.85667 19.89 10.95C19.9233 11.15 19.94 11.4933 19.94 11.98C19.94 12.4667 19.9233 12.81 19.89 13.01C19.6033 15.1033 18.7467 16.8633 17.32 18.29C15.8867 19.7233 14.1233 20.5833 12.03 20.87C11.83 20.9033 11.4867 20.92 11 20.92C10.5133 20.92 10.17 20.9033 9.97 20.87C7.87667 20.5833 6.11333 19.7233 4.68 18.29C3.25333 16.8633 2.41 15.1167 2.15 13.05C1.86333 10.9033 2.32 8.91333 3.52 7.08C4.32667 5.90667 5.32333 4.97 6.51 4.27C7.69667 3.56333 8.99333 3.16667 10.4 3.08ZM9.2 8.58C9.14 8.55333 9.09667 8.54 9.07 8.54C8.92333 8.54 8.79333 8.59667 8.68 8.71L8.64 8.84V11.98V15.12L8.72 15.24C8.86667 15.4133 9.02667 15.4567 9.2 15.37C9.31333 15.3433 10.17 14.8433 11.77 13.87C13.3767 12.8967 14.21 12.38 14.27 12.32C14.5233 12.0933 14.5233 11.8633 14.27 11.63C14.21 11.5767 13.37 11.0633 11.75 10.09C10.13 9.11667 9.28 8.61333 9.2 8.58Z"
        fill={color}
      />
    </Svg>
  );
}

export function SearchIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={8.5} cy={8.5} r={5.5} strokeWidth={2} stroke={color} />
      <Path d="M13.5 13.5L18 18" strokeWidth={2} strokeLinecap="round" stroke={color} />
    </Svg>
  );
}

export function OpenCatalogIcon({ color }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 17L17 7M17 14.5V7H9.5"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={color}
      />
    </Svg>
  );
}

export function TipBubbleIcon({ color }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6.5C4 5.83696 4.26339 5.20107 4.73223 4.73223C5.20107 4.26339 5.83696 4 6.5 4H17.5C18.163 4 18.7989 4.26339 19.2678 4.73223C19.7366 5.20107 20 5.83696 20 6.5V13.5C20 14.163 19.7366 14.7989 19.2678 15.2678C18.7989 15.7366 18.163 16 17.5 16H11L6.5 20V16C5.83696 16 5.20107 15.7366 4.73223 15.2678C4.26339 14.7989 4 14.163 4 13.5V6.5Z"
        strokeWidth={2}
        strokeLinejoin="round"
        stroke={color}
      />
      <Path d="M12 6.8L12.9 8.9L15 9.8L12.9 10.7L12 12.8L11.1 10.7L9 9.8L11.1 8.9L12 6.8Z" fill={color} />
    </Svg>
  );
}

// Start-button play mark — Figma 17:709: a plain rounded triangle (no ring),
// 11.5 × 12.6 placed at (6, 5) in a 22 × 24 box so it reads optically centred.
export function PlayTriangleIcon({ color, scale = 1 }: IconProps & { scale?: number }) {
  return (
    <Svg width={22 * scale} height={24 * scale} viewBox="0 0 22 24" fill="none">
      <Path
        d="M6 6.48C6 5.01 6.64 4.64 7.92 5.35L16.58 10.2C17.86 10.92 17.86 11.64 16.58 12.35L7.92 17.2C6.64 17.92 6 17.54 6 16.08V6.48Z"
        fill={color}
      />
    </Svg>
  );
}

// Theatre-mask mark (the user's Roles logo, Figma icon/roles-mask), viewBox 0 0 226 307.
export const ROLES_MASK_PATH =
  "M139.222 0V307C101.166 306.825 60.5922 290.874 36.7222 262C36.7222 262 0.722253 226.418 0.222241 168.709C-0.277771 111 0.222203 0 0.222203 0H139.222ZM106.409 103.131H53.3152C53.3152 96.1586 54.6885 89.2546 57.3568 82.813C60.025 76.3714 63.9359 70.5184 68.8661 65.5882C73.7964 60.6581 79.6494 56.7473 86.0911 54.0792C92.5328 51.4111 99.4369 50.0379 106.409 50.038V103.131ZM139.222 166.869H53.3152C53.3152 189.653 62.3661 211.504 78.4768 227.614C94.5875 243.725 116.438 252.776 139.222 252.776V166.869ZM172.035 103.131H225.129C225.129 96.1586 223.756 89.2546 221.088 82.813C218.419 76.3714 214.509 70.5184 209.578 65.5882C204.648 60.6581 198.795 56.7473 192.353 54.0792C185.912 51.4111 179.008 50.0379 172.035 50.038V103.131ZM139.222 166.869H225.129C225.129 178.15 222.907 189.321 218.59 199.744C214.273 210.167 207.945 219.637 199.968 227.614C191.99 235.592 182.52 241.919 172.097 246.237C161.675 250.554 150.504 252.776 139.222 252.776V166.869Z";

export function RolesMaskIcon({
  color,
  width = 27,
  height = 36,
  outline,
}: IconProps & { width?: number; height?: number; outline?: { color: string; width: number } }) {
  // An outlined copy keeps the stroke weight in screen points regardless of scale.
  const k = 226 / width;
  return (
    <Svg width={width} height={height} viewBox="0 0 226 307">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d={ROLES_MASK_PATH}
        fill={outline ? "none" : color}
        stroke={outline ? outline.color : undefined}
        strokeWidth={outline ? outline.width * k : undefined}
      />
    </Svg>
  );
}
