// Drop-in replacement for React Native's `Alert.alert` that shows the app's
// own dialog card (components/AppAlertHost, mounted once in app/_layout)
// instead of the system pop-up. Same signature, works on web too.
export type AppAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AppAlertRequest = { title: string; message?: string; buttons: AppAlertButton[] };

type Listener = (req: AppAlertRequest) => void;
let listener: Listener | null = null;

/** Registered by AppAlertHost. */
export function setAppAlertListener(l: Listener | null) {
  listener = l;
}

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const req: AppAlertRequest = { title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] };
  if (listener) listener(req);
  else console.warn("[appAlert] host not mounted:", title, message);
}
