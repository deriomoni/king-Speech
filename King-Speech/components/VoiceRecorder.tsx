// Shared recorder used across the app. The implementation lives in
// WaveformVoiceRecorder so every consumer (level screens, Jenny interview)
// gets the new live waveform UI for free.
export { default } from "@/components/WaveformVoiceRecorder";
