// App entry. The tablet phone-column patch must run before any module reads
// Dimensions, so it is imported ahead of expo-router's entry.
import "./lib/tabletFrame";
import "expo-router/entry";
