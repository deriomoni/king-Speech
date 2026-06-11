# Rive animations

Drop `.riv` files exported from Rive into this folder.

Usage from any screen:

```tsx
import RiveAnim from "@/components/RiveAnim";

<RiveAnim
  source={require("@/assets/rive/jenny.riv")}
  style={{ width: 320, height: 380 }}
  // Optional: pick a specific artboard / state machine inside the .riv
  artboard="Main"
  stateMachine="State Machine 1"
  fit="contain"
  alignment="center"
/>
```

Platform notes:

- Web → renders via `@rive-app/react-canvas` (works in browser preview).
- iOS / Android → renders via `rive-react-native` native module.
  Requires an Expo Launch / Dev Client build — does **not** work in Expo Go
  (a placeholder is shown instead so the screen does not crash).
