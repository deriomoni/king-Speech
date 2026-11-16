// Native (Skia) view of the live Show Time hall: every frame is recorded into
// an SkPicture by the ported scene renderer and shown by a single <Picture/>.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { Canvas, Picture, Skia, type SkImage, type SkPicture } from "@shopify/react-native-skia";
import { SkiaBackend } from "./skiaBackend";
import { HALL } from "./scene";
import { HALL_RATIO, SPRITES, useLiveAudience, type LiveAudienceProps } from "./useLiveAudience";

function useSpriteImages() {
  const [imgs, setImgs] = useState<Record<string, SkImage | null> | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const out: Record<string, SkImage | null> = {};
      await Promise.all(Object.entries(SPRITES).map(async ([name, mod]) => {
        try {
          const uri = Image.resolveAssetSource(mod as any)?.uri;
          const data = uri ? await Skia.Data.fromURI(uri) : null;
          out[name] = data ? Skia.Image.MakeImageFromEncoded(data) : null;
        } catch { out[name] = null; }
      }));
      if (!dead) setImgs(out);
    })();
    return () => { dead = true; };
  }, []);
  return imgs;
}

export default function LiveAudienceSkia(props: LiveAudienceProps) {
  const { width } = props;
  const height = width * HALL_RATIO;
  const imgs = useSpriteImages();
  const backend = useMemo(() => (imgs ? new SkiaBackend(imgs) : null), [imgs]);
  const [pic, setPic] = useState<SkPicture | null>(null);
  const draw = useCallback((A: any, cr: any, t: number, sil: number) => {
    if (!backend) return;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    backend.begin(c, width, height);
    cr.reset(); cr.scale(width / HALL.W, width / HALL.W);
    A.frame(t, sil);
    setPic(rec.finishRecordingAsPicture());
  }, [backend, width, height]);
  const { overlay } = useLiveAudience(props, backend, draw);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height }}>
      <Canvas style={{ width, height }}>{pic && <Picture picture={pic} />}</Canvas>
      {overlay}
    </View>
  );
}
