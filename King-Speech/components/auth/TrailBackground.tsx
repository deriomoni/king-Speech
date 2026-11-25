// Sign-in background: the «Gradient Trail» animation from the After Effects
// project (Gradient_Trail_Project_File_01.aep) — 11 scrolling grey-stripe
// columns with staggered starts → Colorama → Mirror → Warp «Squeeze» → CC
// Radial Fast Blur — re-rendered offline in the brand's warm palette into a
// seamless 5-second loop, and played here muted, looping, behind everything.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

export const TRAIL_BG = "#0E0604";

const SOURCE = require("@/assets/video/sign-in-trail.mp4");

export default function TrailBackground() {
  const player = useVideoPlayer(SOURCE, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: TRAIL_BG }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
