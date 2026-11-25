import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    // every step of sign-up crossfades softly (longer than the default fade)
    <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 450, gestureEnabled: false, contentStyle: { backgroundColor: "#000000" } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="email" options={{ animation: "fade", animationDuration: 350, gestureEnabled: true }} />
      {/* Oscar's introduction: a slow fade into black */}
      <Stack.Screen name="profile-setup" options={{ animation: "fade", animationDuration: 800 }} />
      <Stack.Screen name="survey" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
