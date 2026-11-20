// Phone column on tablets.
//
// King Speech is a phone-only design (app.config: ios.supportsTablet = false),
// so in a real build an iPad runs it in iPhone compatibility mode and every
// layout matches the phone. Expo Go, however, always runs full-iPad-size, which
// stretches phone layouts across ~830pt and breaks them (Show Time, results…).
//
// On a tablet-sized screen we therefore render the app inside a centred
// phone-width column (see PhoneFrame in app/_layout.tsx) and make every
// width measurement (Dimensions.get / useWindowDimensions, incl. change
// events) report that column's width. Imported FIRST from index.js, before
// any module can read Dimensions. On phones this is a no-op.
import { Dimensions, Platform } from "react-native";

export const PHONE_FRAME_W = 430;

const screen = Dimensions.get("screen");
export const IS_TABLET =
  Platform.OS !== "web" && Math.min(screen.width, screen.height) >= 600;

type Metrics = { width: number; height: number; scale: number; fontScale: number };
const clampW = <T extends Metrics>(m: T): T =>
  m && m.width > PHONE_FRAME_W ? { ...m, width: PHONE_FRAME_W } : m;

if (IS_TABLET) {
  const D = Dimensions as any;
  const origGet = D.get.bind(Dimensions);
  D.get = (dim: "window" | "screen") => {
    const m = origGet(dim);
    return dim === "window" ? clampW(m) : m;
  };
  const origAdd = D.addEventListener.bind(Dimensions);
  D.addEventListener = (type: string, handler: (e: any) => void) =>
    origAdd(type, (e: any) => handler(e && e.window ? { ...e, window: clampW(e.window) } : e));
}
