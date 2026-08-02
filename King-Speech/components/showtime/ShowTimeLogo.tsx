import React, { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { SHOW_TIME_LOGO_XML } from "./showTimeLogoXml";
import { SHOW_TIME_LOGO_LIGHT_XML } from "./showTimeLogoLightXml";

const ASPECT = 423.12 / 721.43; // native height / width from the SVG viewBox
const ASPECT_LIGHT = 179 / 320; // light-theme wordmark viewBox

interface ShowTimeLogoProps {
  width?: number;
  color?: string;
}

export function ShowTimeLogo({ width = 240, color = "#F5A623" }: ShowTimeLogoProps) {
  const xml = useMemo(
    () => SHOW_TIME_LOGO_XML.replace("__FILL__", color),
    [color],
  );
  return <SvgXml xml={xml} width={width} height={width * ASPECT} />;
}

// Colorful wordmark for the light theme (self-colored — no tint).
export function ShowTimeLogoLight({ width = 240 }: { width?: number }) {
  return (
    <SvgXml xml={SHOW_TIME_LOGO_LIGHT_XML} width={width} height={width * ASPECT_LIGHT} />
  );
}
