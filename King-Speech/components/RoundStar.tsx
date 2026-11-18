// The one rating star used across the app (everywhere except the «Уровень
// пройден» victory screen, which has its own 3D stars). Rounded corners and
// proportions come from the Figma Show Time star (starOnXml). Filled = gold,
// empty = the same shape as a soft solid tint — no outline variant.
import React from "react";
import Svg, { Path } from "react-native-svg";

export const STAR_GOLD = "#FFD857";
const D =
  "M13.3427 5.51252C13.8798 3.92849 16.1202 3.92849 16.6573 5.51252L17.9652 9.36951C18.206 10.0797 18.8725 10.5575 19.6224 10.5575L23.6905 10.5577C25.4037 10.5577 26.0964 12.7648 24.6905 13.7438L21.5293 15.945C20.8898 16.3903 20.6218 17.2049 20.872 17.943L22.1093 21.5927C22.6514 23.192 20.8378 24.5556 19.452 23.5908L15.9999 21.1874C15.399 20.769 14.601 20.769 14.0001 21.1874L10.548 23.5908C9.16216 24.5556 7.34859 23.192 7.89074 21.5927L9.12801 17.943C9.37822 17.2049 9.11022 16.3903 8.47067 15.945L5.3095 13.7438C3.90358 12.7648 4.59627 10.5577 6.30945 10.5577L10.3776 10.5575C11.1275 10.5575 11.794 10.0797 12.0348 9.36951L13.3427 5.51252Z";

export default function RoundStar({
  size = 24,
  filled = true,
  color = STAR_GOLD,
  emptyColor = "#8C8C96",
  emptyOpacity = 0.28,
  style,
}: {
  size?: number;
  filled?: boolean;
  color?: string;
  emptyColor?: string;
  emptyOpacity?: number;
  style?: any;
}) {
  return (
    // viewBox trimmed to the star's own bounds so `size` is the visible size
    <Svg width={size} height={size} viewBox="3.9 3.2 22.2 22.2" style={style}>
      <Path d={D} fill={filled ? color : emptyColor} fillOpacity={filled ? 1 : emptyOpacity} />
    </Svg>
  );
}
