import React from "react";
import { Image, StyleSheet, View } from "react-native";

const BG = require("../../assets/images/profile-bg.png");

export function PurpleBg() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0A0A0C" }]}>
      <Image
        source={BG}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
