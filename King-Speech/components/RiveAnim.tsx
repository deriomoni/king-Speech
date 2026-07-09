import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import Constants from "expo-constants";

// WebView is only loaded on native+ExpoGo (it's not needed on web, where we
// use the real @rive-app/react-canvas). require() inside a guard so web
// bundles don't pull in the native module.
let WebViewComp: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComp = require("react-native-webview").WebView;
  } catch {
    WebViewComp = null;
  }
}

export type RiveFit =
  | "contain"
  | "cover"
  | "fill"
  | "fitWidth"
  | "fitHeight"
  | "none"
  | "scaleDown";

export type RiveAlignment =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "center"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

type RiveAnimProps = {
  source: number | { uri: string };
  style?: ViewStyle;
  artboard?: string;
  stateMachine?: string;
  animation?: string;
  autoplay?: boolean;
  fit?: RiveFit;
  alignment?: RiveAlignment;
  /**
   * Post-process each drawn frame: make the artboard's baked-in white
   * background transparent. Uses a flood fill from the canvas borders, so
   * enclosed white areas (eyes, teeth) are preserved. Web + Expo Go WebView
   * only — a true native build renders the artboard as authored.
   */
  removeWhiteBg?: boolean;
};

// Flood-fills near-white pixels reachable from the canvas borders and makes
// them transparent. Called after every Rive draw.
function keyOutWhiteBg(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const visited = new Uint8Array(n);
  const stack: number[] = [];
  // Background = near-white OR already transparent. With fit=contain the
  // artboard's white rect is inset from the canvas border by transparent
  // margins, so the flood must be able to travel through transparency.
  const isBg = (i: number) => {
    const o = i * 4;
    if (d[o + 3] < 16) return true;
    return d[o] > 232 && d[o + 1] > 232 && d[o + 2] > 232;
  };
  // Seed from all four borders.
  for (let x = 0; x < w; x++) {
    if (isBg(x)) stack.push(x);
    const b = (h - 1) * w + x;
    if (isBg(b)) stack.push(b);
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    if (isBg(l)) stack.push(l);
    const r = y * w + (w - 1);
    if (isBg(r)) stack.push(r);
  }
  while (stack.length) {
    const i = stack.pop()!;
    if (visited[i]) continue;
    visited[i] = 1;
    d[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0 && !visited[i - 1] && isBg(i - 1)) stack.push(i - 1);
    if (x < w - 1 && !visited[i + 1] && isBg(i + 1)) stack.push(i + 1);
    if (i >= w && !visited[i - w] && isBg(i - w)) stack.push(i - w);
    if (i < n - w && !visited[i + w] && isBg(i + w)) stack.push(i + w);
  }
  // Soften the 1px halo: fade light pixels that touch a keyed-out pixel.
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const x = i % w;
    const nearKeyed =
      (x > 0 && visited[i - 1]) ||
      (x < w - 1 && visited[i + 1]) ||
      (i >= w && visited[i - w]) ||
      (i < n - w && visited[i + w]);
    if (!nearKeyed) continue;
    const o = i * 4;
    const minC = Math.min(d[o], d[o + 1], d[o + 2]);
    if (minC > 190) {
      const t = (minC - 190) / 42; // 190..232 → 0..1
      d[o + 3] = Math.round(d[o + 3] * (1 - Math.min(1, t)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const dbg = ((keyOutWhiteBg as any)._n = ((keyOutWhiteBg as any)._n || 0) + 1);
  if (dbg <= 3 || dbg % 60 === 0) {
    let keyed = 0;
    for (let i = 0; i < n; i++) if (visited[i]) keyed++;
    const mid = ((h >> 1) * w + (w >> 1)) * 4;
    console.log(
      "[RiveAnim DEBUG key]", "call#", dbg, w, h, "keyed=", keyed,
      "centerPx=", d[mid], d[mid + 1], d[mid + 2], d[mid + 3],
      "connected=", (canvas as any).isConnected,
    );
  }
}

const isExpoGo =
  (Constants as any)?.appOwnership === "expo" ||
  (Constants as any)?.executionEnvironment === "storeClient";

let NativeRive: any = null;
let WebRive: any = null;
let useRiveHook: any = null;

let WebRiveLayout: any = null;
let WebRiveFit: any = null;
let WebRiveAlign: any = null;

if (Platform.OS === "web") {
  try {
    const mod = require("@rive-app/react-canvas");
    WebRive = mod?.default ?? mod?.Rive ?? null;
    useRiveHook = mod?.useRive ?? null;
    WebRiveLayout = mod?.Layout ?? null;
    WebRiveFit = mod?.Fit ?? null;
    WebRiveAlign = mod?.Alignment ?? null;
    console.log(
      "[RiveAnim] web module loaded, useRive=",
      typeof useRiveHook,
      " hasLayout=",
      !!WebRiveLayout,
    );
  } catch (e) {
    WebRive = null;
    console.warn("[RiveAnim] failed to load @rive-app/react-canvas:", e);
  }
}

const FIT_MAP_WEB: Record<RiveFit, string> = {
  contain: "Contain",
  cover: "Cover",
  fill: "Fill",
  fitWidth: "FitWidth",
  fitHeight: "FitHeight",
  none: "None",
  scaleDown: "ScaleDown",
};

const ALIGN_MAP_WEB: Record<RiveAlignment, string> = {
  topLeft: "TopLeft",
  topCenter: "TopCenter",
  topRight: "TopRight",
  centerLeft: "CenterLeft",
  center: "Center",
  centerRight: "CenterRight",
  bottomLeft: "BottomLeft",
  bottomCenter: "BottomCenter",
  bottomRight: "BottomRight",
};

if (Platform.OS !== "web" && !isExpoGo) {
  try {
    const mod = require("rive-react-native");
    NativeRive = mod?.default ?? null;
  } catch {
    NativeRive = null;
  }
}

const FIT_MAP_NATIVE: Record<RiveFit, string> = {
  contain: "contain",
  cover: "cover",
  fill: "fill",
  fitWidth: "fitWidth",
  fitHeight: "fitHeight",
  none: "none",
  scaleDown: "scaleDown",
};

const ALIGN_MAP_NATIVE: Record<RiveAlignment, string> = {
  topLeft: "topLeft",
  topCenter: "topCenter",
  topRight: "topRight",
  centerLeft: "centerLeft",
  center: "center",
  centerRight: "centerRight",
  bottomLeft: "bottomLeft",
  bottomCenter: "bottomCenter",
  bottomRight: "bottomRight",
};

function resolveRiveSrc(source: RiveAnimProps["source"]): string | null {
  if (!source) return null;
  if (typeof source === "object" && "uri" in source && source.uri) {
    return source.uri;
  }
  // On Metro web, `require("./foo.riv")` for a non-image asset can be:
  //  - a string URL (some bundler configs),
  //  - a number (asset id, needs registry lookup),
  //  - an object { uri }.
  if (typeof source === "string") return source;
  if (typeof source === "object" && (source as any).uri) {
    return (source as any).uri;
  }
  // Numeric require() — try React Native's asset registry first.
  try {
    const { Image } = require("react-native");
    const resolved = Image.resolveAssetSource(source);
    if (resolved?.uri) return resolved.uri;
  } catch {}
  // Fallback: ask expo-asset to resolve the bundled asset module. This
  // path actually works on Metro web for `.riv` and other custom asset
  // extensions, where the legacy AssetRegistry returns null.
  try {
    const { Asset } = require("expo-asset");
    const asset = Asset.fromModule(source);
    return asset?.uri ?? asset?.localUri ?? null;
  } catch (e) {
    console.warn("[RiveAnim] expo-asset resolve failed:", e);
    return null;
  }
}

function WebRiveCanvas({
  src,
  style,
  artboard,
  stateMachine,
  animation,
  autoplay = true,
  fit = "contain",
  alignment = "center",
  removeWhiteBg = false,
}: RiveAnimProps & { src: string }) {
  const containerRef = React.useRef<any>(null);
  let layoutInstance: any = undefined;
  try {
    if (WebRiveLayout && WebRiveFit && WebRiveAlign) {
      const fitKey = FIT_MAP_WEB[fit] ?? "Contain";
      const alignKey = ALIGN_MAP_WEB[alignment] ?? "Center";
      layoutInstance = new WebRiveLayout({
        fit: WebRiveFit[fitKey] ?? WebRiveFit.Contain,
        alignment: WebRiveAlign[alignKey] ?? WebRiveAlign.Center,
      });
    }
  } catch (e) {
    console.warn("[RiveAnim] failed to build Layout:", e);
    layoutInstance = undefined;
  }
  const { rive, RiveComponent } = useRiveHook({
    src,
    artboard,
    stateMachines: stateMachine,
    animations: animation,
    autoplay,
    ...(layoutInstance ? { layout: layoutInstance } : {}),
  });

  useEffect(() => {
    if (!removeWhiteBg || !rive) return;
    const node: HTMLElement | null = containerRef.current as any;
    const canvas = node?.querySelector?.("canvas") ?? null;
    if (!canvas) return;
    try {
      const all = node!.querySelectorAll("canvas");
      const cs = (window as any).getComputedStyle(canvas);
      let p: any = canvas.parentElement;
      const bgs: string[] = [];
      while (p && p !== node!.parentElement) {
        bgs.push((window as any).getComputedStyle(p).backgroundColor);
        p = p.parentElement;
      }
      console.log(
        "[RiveAnim DEBUG dom] canvases=", all.length,
        "canvasBg=", cs.backgroundColor,
        "parentBgs=", JSON.stringify(bgs),
      );
    } catch {}
    const onDraw = () => {
      try {
        keyOutWhiteBg(canvas as HTMLCanvasElement);
      } catch {}
    };
    try {
      // The web runtime reports "advance" right after each frame is drawn
      // and flushed (it never emits "draw"), so this is the post-frame hook.
      rive.on("advance", onDraw);
      // Key the current frame too (e.g. a one-shot animation that already
      // finished before this effect ran).
      onDraw();
    } catch (e) {
      console.warn("[RiveAnim] advance hook failed:", e);
    }
    return () => {
      try {
        rive.off("advance", onDraw);
      } catch {}
    };
  }, [removeWhiteBg, rive]);

  return (
    <View ref={containerRef} style={[styles.box, style]}>
      <RiveComponent />
    </View>
  );
}

function WebRiveView(props: RiveAnimProps) {
  const src = resolveRiveSrc(props.source);
  if (!useRiveHook || !src) {
    console.warn(
      "[RiveAnim] web placeholder: useRive=",
      !!useRiveHook,
      " src=",
      src,
    );
    return <Placeholder style={props.style} message="Rive (web) недоступен" />;
  }
  return <WebRiveCanvas {...props} src={src} />;
}

// ── Expo Go fallback ─────────────────────────────────────────────────────
// The native module `rive-react-native` is not bundled in Expo Go, so we
// render the same .riv inside a WebView that loads the Rive web runtime
// from a CDN. Works on the device because the WebView can fetch the .riv
// from Metro (asset URL resolved via expo-asset) over the same LAN.
function buildExpoGoHtml(
  riveUrl: string,
  fit: RiveFit,
  alignment: RiveAlignment,
  autoplay: boolean,
  artboard?: string,
  stateMachine?: string,
  animation?: string,
  removeWhiteBg?: boolean,
): string {
  const fitKey = FIT_MAP_WEB[fit] ?? "Contain";
  const alignKey = ALIGN_MAP_WEB[alignment] ?? "Center";
  const safeArtboard = artboard ? JSON.stringify(artboard) : "undefined";
  const safeSM = stateMachine ? JSON.stringify(stateMachine) : "undefined";
  const safeAnim = animation ? JSON.stringify(animation) : "undefined";
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden;height:100%;}
canvas{display:block;width:100vw;height:100vh;background:transparent;}
</style></head><body>
<canvas id="c"></canvas>
<script src="https://unpkg.com/@rive-app/canvas@2.21.6"></script>
<script>
(function(){
  function log(m){ try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(m)); }catch(e){} }
  try {
    var R = window.rive;
    if (!R) { log("rive runtime missing"); return; }
    var r = new R.Rive({
      src: ${JSON.stringify(riveUrl)},
      canvas: document.getElementById("c"),
      autoplay: ${autoplay ? "true" : "false"},
      artboard: ${safeArtboard},
      stateMachines: ${safeSM},
      animations: ${safeAnim},
      layout: new R.Layout({ fit: R.Fit.${fitKey}, alignment: R.Alignment.${alignKey} }),
      onLoad: function(){ try { r.resizeDrawingSurfaceToCanvas(); } catch(e){} log("loaded"); },
      onLoadError: function(e){ log("loadError "+(e && e.message || e)); },
    });
    ${
      removeWhiteBg
        ? `var cv = document.getElementById("c");
    function keyWhite(){
      try {
        var ctx = cv.getContext("2d");
        var w = cv.width, h = cv.height;
        if (!w || !h) return;
        var img = ctx.getImageData(0, 0, w, h), d = img.data, n = w * h;
        var visited = new Uint8Array(n), stack = [];
        function isBg(i){ var o = i * 4; return d[o+3] < 16 || (d[o] > 232 && d[o+1] > 232 && d[o+2] > 232); }
        for (var x = 0; x < w; x++) { if (isBg(x)) stack.push(x); var b = (h-1)*w + x; if (isBg(b)) stack.push(b); }
        for (var y = 0; y < h; y++) { var l = y*w; if (isBg(l)) stack.push(l); var rr = y*w + w-1; if (isBg(rr)) stack.push(rr); }
        while (stack.length) {
          var i = stack.pop();
          if (visited[i]) continue;
          visited[i] = 1; d[i*4+3] = 0;
          var xx = i % w;
          if (xx > 0 && !visited[i-1] && isBg(i-1)) stack.push(i-1);
          if (xx < w-1 && !visited[i+1] && isBg(i+1)) stack.push(i+1);
          if (i >= w && !visited[i-w] && isBg(i-w)) stack.push(i-w);
          if (i < n-w && !visited[i+w] && isBg(i+w)) stack.push(i+w);
        }
        for (var j = 0; j < n; j++) {
          if (visited[j]) continue;
          var xj = j % w;
          var near = (xj > 0 && visited[j-1]) || (xj < w-1 && visited[j+1]) || (j >= w && visited[j-w]) || (j < n-w && visited[j+w]);
          if (!near) continue;
          var o2 = j * 4;
          var mc = Math.min(d[o2], d[o2+1], d[o2+2]);
          if (mc > 190) { var t = Math.min(1, (mc - 190) / 42); d[o2+3] = Math.round(d[o2+3] * (1 - t)); }
        }
        ctx.putImageData(img, 0, 0);
      } catch(e) {}
    }
    try { r.on("advance", keyWhite); } catch(e) { log("advance hook "+(e && e.message || e)); }`
        : ""
    }
    window.addEventListener("resize", function(){ try{ r.resizeDrawingSurfaceToCanvas(); }catch(e){} });
  } catch(e) { log("ctor "+(e && e.message || e)); }
})();
</script></body></html>`;
}

function ExpoGoRiveView({
  source,
  style,
  artboard,
  stateMachine,
  animation,
  autoplay = true,
  fit = "contain",
  alignment = "center",
  removeWhiteBg = false,
}: RiveAnimProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve the bundled asset to a local file, then read it as base64
        // and embed it as a data: URL inside the WebView's HTML. We avoid
        // having the WebView fetch the .riv from Metro because Metro's CORS
        // middleware throws "Invalid URL" on requests without an origin
        // (which is the case for WebViews loaded via `source={{ html }}`).
        const { Asset } = require("expo-asset");
        const FS = require("expo-file-system/legacy");
        const asset = Asset.fromModule(source);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        const localUri: string | undefined = asset.localUri || asset.uri;
        if (!localUri) {
          if (!cancelled) setErr("no asset uri");
          return;
        }
        let base64: string | null = null;
        if (localUri.startsWith("file://") || localUri.startsWith("/")) {
          base64 = await FS.readAsStringAsync(localUri, {
            encoding: "base64",
          });
        } else {
          // http(s) URL (rare on Expo Go after downloadAsync, but handle it).
          const res = await fetch(localUri);
          const buf = await res.arrayBuffer();
          // Manually encode without Buffer (RN doesn't ship Buffer).
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          // btoa is available in RN's JSC/Hermes via the global polyfill.
          base64 = (global as any).btoa
            ? (global as any).btoa(binary)
            : null;
        }
        if (!cancelled) {
          if (base64) {
            setDataUrl(`data:application/octet-stream;base64,${base64}`);
          } else {
            setErr("could not read asset bytes");
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
        console.warn("[RiveAnim] expo-go asset resolve failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!WebViewComp) {
    return (
      <Placeholder
        style={style}
        message="WebView недоступен — установи react-native-webview"
      />
    );
  }
  if (err) {
    return <Placeholder style={style} message={`Rive: ${err}`} />;
  }
  if (!dataUrl) {
    // Brief loading frame — avoids flashing the placeholder text.
    return <View style={[styles.box, style]} />;
  }

  const html = buildExpoGoHtml(
    dataUrl,
    fit,
    alignment,
    autoplay,
    artboard,
    stateMachine,
    animation,
    removeWhiteBg,
  );
  return (
    <View style={[styles.box, style]}>
      <WebViewComp
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        onMessage={(e: any) => {
          const msg = e?.nativeEvent?.data;
          if (msg && String(msg).startsWith("loadError")) {
            console.warn("[RiveAnim] expo-go", msg);
          }
        }}
        onError={(e: any) =>
          console.warn("[RiveAnim] WebView error", e?.nativeEvent)
        }
      />
    </View>
  );
}

function NativeRiveView({
  source,
  style,
  artboard,
  stateMachine,
  animation,
  autoplay = true,
  fit = "contain",
  alignment = "center",
}: RiveAnimProps) {
  if (!NativeRive) {
    return (
      <Placeholder
        style={style}
        message={
          isExpoGo
            ? "Rive-анимация доступна только в Expo Launch сборке"
            : "Rive native module не найден"
        }
      />
    );
  }
  const src = resolveRiveSrc(source);
  // rive-react-native accepts either `resourceName` (bundled file name without
  // extension) or `url` for remote files. We pass `url` for both, since the
  // resolved asset URI works the same way.
  return (
    <NativeRive
      style={[styles.box, style]}
      url={src ?? undefined}
      artboardName={artboard}
      stateMachineName={stateMachine}
      animationName={animation}
      autoplay={autoplay}
      fit={FIT_MAP_NATIVE[fit]}
      alignment={ALIGN_MAP_NATIVE[alignment]}
    />
  );
}

function Placeholder({
  style,
  message,
}: {
  style?: ViewStyle;
  message: string;
}) {
  return (
    <View style={[styles.box, styles.placeholder, style]}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

export default function RiveAnim(props: RiveAnimProps) {
  if (Platform.OS === "web") {
    return <WebRiveView {...props} />;
  }
  // On Expo Go the native rive module is not bundled. Use the WebView
  // fallback so animations are still visible during development.
  if (isExpoGo) {
    return <ExpoGoRiveView {...props} />;
  }
  return <NativeRiveView {...props} />;
}

const styles = StyleSheet.create({
  box: {
    overflow: "hidden",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 104, 251, 0.08)",
    borderRadius: 12,
    padding: 12,
  },
  placeholderText: {
    color: "#9468FB",
    fontSize: 12,
    textAlign: "center",
    opacity: 0.8,
  },
});
