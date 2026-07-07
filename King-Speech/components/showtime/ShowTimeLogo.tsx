import React, { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { SHOW_TIME_LOGO_XML } from "./showTimeLogoXml";

const ASPECT = 423.12 / 721.43; // native height / width from the SVG viewBox

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
