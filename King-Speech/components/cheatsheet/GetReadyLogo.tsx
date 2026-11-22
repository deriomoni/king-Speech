import React from "react";
import Svg, { Path } from "react-native-svg";
import { rs } from "@/lib/responsive";
import { GET_READY_D, GET_READY_H, GET_READY_W } from "./getReadyWordmark";

// "Get Ready" wordmark set in Pacifico (the Show Time logo's look-alike),
// thinned to Show Time's stroke weight — see scripts/get-ready-wordmark.js.
export default function GetReadyLogo({
  width = rs(220),
  color = "#0E0E16",
}: {
  width?: number;
  color?: string;
}) {
  const height = (width * GET_READY_H) / GET_READY_W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${GET_READY_W} ${GET_READY_H}`} fill="none">
      <Path d={GET_READY_D} fill={color} />
    </Svg>
  );
}
