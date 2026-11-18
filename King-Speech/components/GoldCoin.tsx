// Full-colour gold coin with the crown mark (used on the «Монеты» screen).
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export const COIN_GOLD = "#FFD857";

export default function GoldCoin({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={13.1} fill={COIN_GOLD} stroke="#E3A92B" strokeWidth={1.8} />
      <Circle cx={14} cy={14} r={10.4} fill="none" stroke="rgba(207,144,14,0.35)" strokeWidth={1} />
      <Path
        d="M7.6 10.4l3.1 3.1 3.3-5.1 3.3 5.1 3.1-3.1-1.1 7.2H8.7z"
        fill="#CF900E"
        stroke="#CF900E"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
