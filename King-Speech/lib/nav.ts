import { router, type Href } from "expo-router";

/**
 * Leave the current screen / flow and return to where the player came from.
 *
 * Level chains (next level, Show Time → next path level, role stage → result)
 * use router.replace, so a single pop lands on whatever opened the flow: the
 * Path tab, a world, the Show Time tab, the theme catalog… Only with no
 * history (deep link / cold start) do we open `fallback`.
 *
 * Never router.replace("/(tabs)") from a pushed screen: that mounts a SECOND
 * tabs navigator on its first tab (Path), and a back-swipe then reveals the
 * old one (e.g. Show Time) underneath.
 */
export function leaveTo(fallback: Href = "/(tabs)") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/**
 * Close a whole finished flow that may span several pushed screens (e.g. roles
 * → brief → result): pop back to the tabs the player started from, keeping the
 * tab they were on, so a back-swipe can't reopen the finished screens.
 */
export function leaveFlowToTabs(fallback: Href = "/(tabs)") {
  if (router.canDismiss()) router.dismissAll();
  else if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
