// App entry. Tablet scaling (lib/responsive) patches StyleSheet.create, so it
// must load before any screen or component defines its styles.
import "./lib/responsive";
import "expo-router/entry";
