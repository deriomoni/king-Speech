import React from "react";
import { SvgXml } from "react-native-svg";
import { ROLE_ART } from "@/constants/roleArt";

/** True when a role has a supplied graphic (others are hidden for now). */
export function hasRoleArt(id: string): boolean {
  return !!ROLE_ART[id];
}

/**
 * Renders a role's graphic centered inside a square `size` box (aspect ratio
 * preserved via the SVG viewBox), so every role image reads at the same size.
 */
export default function RoleArt({ id, size = 84 }: { id: string; size?: number }) {
  const xml = ROLE_ART[id];
  if (!xml) return null;
  return <SvgXml xml={xml} width={size} height={size} />;
}
