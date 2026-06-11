import React, { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import { Asset } from "expo-asset";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

const jennyDefault = require("@/assets/jenny/jenny_default.png");
const jennySmiling = require("@/assets/jenny/jenny_smiling.png");
const jennyAngry = require("@/assets/jenny/jenny_angry.png");
const jennyTalking = require("@/assets/jenny/jenny_talking.png");
const jennyBlinking = require("@/assets/jenny/jenny_blinking.png");
const jennyOutraged = require("@/assets/jenny/jenny_outraged.png");
const jennySuspicious = require("@/assets/jenny/jenny_suspicious.png");

const ALL_IMAGES = [jennyDefault, jennySmiling, jennyAngry, jennyTalking, jennyBlinking, jennyOutraged, jennySuspicious];

export type AvatarState =
  | "idle"
  | "speaking"
  | "listening"
  | "thinking"
  | "reacting"
  | "positive"
  | "negative"
  | "outraged";

const { width: SCREEN_W } = Dimensions.get("window");
const IMG_ASPECT = 400 / 331;

let assetsPreloaded = false;
function preloadAssets() {
  if (assetsPreloaded) return;
  assetsPreloaded = true;
  try {
    Asset.loadAsync(ALL_IMAGES).catch(() => {});
  } catch {
  }
}
preloadAssets();

export default function JennyAvatar({ state }: { state: AvatarState }) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [talkFrame, setTalkFrame] = useState(false);
  const [loaded, setLoaded] = useState(assetsPreloaded);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const talkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const breatheScale = useSharedValue(1);

  useEffect(() => {
    if (!loaded) {
      const t = setTimeout(() => setLoaded(true), 500);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.008, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(breatheScale);
  }, []);

  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 4000 + Math.random() * 6000;
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160);
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state === "speaking") {
      setTalkFrame(false);
      talkTimer.current = setInterval(() => {
        setTalkFrame((prev) => !prev);
      }, 280);
    } else {
      if (talkTimer.current) {
        clearInterval(talkTimer.current);
        talkTimer.current = null;
      }
      setTalkFrame(false);
    }
    return () => {
      if (talkTimer.current) clearInterval(talkTimer.current);
    };
  }, [state]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: breatheScale.value }],
  }));

  let currentImage = jennyDefault;
  if (isBlinking && state !== "speaking") {
    currentImage = jennyBlinking;
  } else if (state === "speaking") {
    currentImage = talkFrame ? jennyTalking : jennyDefault;
  } else if (state === "positive" || state === "reacting") {
    currentImage = jennySmiling;
  } else if (state === "negative") {
    currentImage = jennyAngry;
  } else if (state === "outraged") {
    currentImage = jennyOutraged;
  } else if (state === "thinking") {
    currentImage = jennySuspicious;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.avatarWrap, breatheStyle]}>
        <Image
          source={currentImage}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const imgW = Math.min(SCREEN_W * 0.78, 340);
const imgH = imgW * IMG_ASPECT;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  avatarWrap: {
    width: imgW,
    height: imgH,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  avatarImage: {
    width: imgW,
    height: imgH,
  },
});
