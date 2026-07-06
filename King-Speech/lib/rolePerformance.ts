// Transient, in-memory hand-off between the role-stage (recorder) and the
// role-result (scoring) screens. Base64 audio can be large, so we deliberately
// avoid serialising it through navigation params / the URL. Same JS runtime on
// both native and web, so a module-scoped holder is the simplest safe channel.

export interface RolePerformance {
  roleId: string;
  mode: "scripted" | "improv";
  durationSeconds: number;
  /** Recorded audio (base64, no data: prefix). Sent to the server for scoring. */
  audioBase64?: string;
  /** Local-only video URI for the on-device preview. NEVER uploaded. */
  videoUri?: string;
}

let _pending: RolePerformance | null = null;

export function setRolePerformance(p: RolePerformance) {
  _pending = p;
}

export function takeRolePerformance(): RolePerformance | null {
  const p = _pending;
  _pending = null;
  return p;
}

export function peekRolePerformance(): RolePerformance | null {
  return _pending;
}
