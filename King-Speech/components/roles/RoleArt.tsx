import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { ROLE_ART, ROLE_FACE } from "@/constants/roleArt";

/** True when a role has a supplied graphic (others are hidden for now). */
export function hasRoleArt(id: string): boolean {
  return !!ROLE_ART[id];
}

/**
 * Renders a role's illustration in a square `size` box. The art is drawn on
 * pure white, so the box is white too — it reads as the illustration's paper.
 * `face` crops into the character's head (hand-tuned per role in ROLE_FACE)
 * for small avatars where the full scene would be unreadable.
 */
export default function RoleArt({
  id,
  size = 84,
  radius = 0,
  face = false,
}: {
  id: string;
  size?: number;
  radius?: number;
  face?: boolean;
}) {
  const src = ROLE_ART[id];
  if (!src) return null;

  const focus = face ? ROLE_FACE[id] : undefined;
  let imageStyle: any = { width: size, height: size };
  if (focus) {
    const big = size * focus.zoom;
    const clamp = (v: number) => Math.min(0, Math.max(size - big, v));
    imageStyle = {
      position: "absolute",
      width: big,
      height: big,
      left: clamp(size / 2 - focus.x * big),
      top: clamp(size / 2 - focus.y * big),
    };
  }

  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", backgroundColor: "#FFFFFF" }}>
      <Image source={src} style={imageStyle} contentFit="cover" transition={0} />
    </View>
  );
}
