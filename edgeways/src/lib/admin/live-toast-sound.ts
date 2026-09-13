import type { LiveEventKind } from "@/lib/admin/live-bundle";

export const ADMIN_LIVE_SOUND_KEY = "edgeways.admin-live-sound";
export const ADMIN_LIVE_SOUND_CHANGE_EVENT = "edgeways:admin-live-sound";
export const ADMIN_LIVE_SOUND_GAP_MS = 400;

export const ADMIN_LIVE_SOUND_IDS = ["desk", "notice", "alarm"] as const;
export type AdminLiveSoundId = (typeof ADMIN_LIVE_SOUND_IDS)[number];

type Voice = {
  hz: number;
  type: OscillatorType;
  at: number;
  dur: number;
  gain: number;
};

/** Soft rising chime for desk volume. Amber drop for feed. Low double knock for outages. */
export const ADMIN_LIVE_SOUND_LIBRARY: Record<AdminLiveSoundId, readonly Voice[]> = {
  desk: [
    { hz: 698, type: "sine", at: 0, dur: 0.08, gain: 0.055 },
    { hz: 880, type: "triangle", at: 0.055, dur: 0.13, gain: 0.04 },
  ],
  notice: [
    { hz: 587, type: "sine", at: 0, dur: 0.11, gain: 0.065 },
    { hz: 494, type: "sine", at: 0.095, dur: 0.16, gain: 0.05 },
  ],
  alarm: [
    { hz: 196, type: "sine", at: 0, dur: 0.12, gain: 0.08 },
    { hz: 247, type: "triangle", at: 0.035, dur: 0.14, gain: 0.048 },
    { hz: 196, type: "sine", at: 0.2, dur: 0.15, gain: 0.072 },
  ],
};

export function adminLiveSoundForKind(kind: LiveEventKind): AdminLiveSoundId {
  if (kind === "health_error" || kind === "feed_critical") return "alarm";
  if (kind === "feed_warning") return "notice";
  return "desk";
}

export function pickAdminLiveSound(kinds: readonly LiveEventKind[]): AdminLiveSoundId {
  const ids = kinds.map(adminLiveSoundForKind);
  if (ids.includes("alarm")) return "alarm";
  if (ids.includes("notice")) return "notice";
  return "desk";
}

export function parseAdminLiveSoundEnabled(raw: string | null | undefined): boolean {
  if (raw === "0") return false;
  return true;
}

export function readAdminLiveSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return parseAdminLiveSoundEnabled(window.localStorage.getItem(ADMIN_LIVE_SOUND_KEY));
  } catch {
    return true;
  }
}

export function writeAdminLiveSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_LIVE_SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode. The in-memory listeners still get the event.
  }
  window.dispatchEvent(
    new CustomEvent<boolean>(ADMIN_LIVE_SOUND_CHANGE_EVENT, { detail: enabled })
  );
}

export function shouldPlayAdminLiveSound(
  soundEnabled: boolean,
  toastCount: number,
  lastPlayedAt: number,
  now: number,
  gapMs = ADMIN_LIVE_SOUND_GAP_MS
): boolean {
  return soundEnabled && toastCount > 0 && now - lastPlayedAt >= gapMs;
}

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
  return audioCtx;
}

/** Browsers block sound until a click. Call once from Admin chrome. */
export function unlockAdminLiveSound(): void {
  const ctx = context();
  if (!ctx || ctx.state !== "suspended") return;
  void ctx.resume().catch(() => {});
}

function voice(
  ctx: AudioContext,
  spec: Voice,
  origin: number
): void {
  const when = origin + spec.at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.hz, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(spec.gain, when + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + spec.dur + 0.02);
}

export function playAdminLiveSound(id: AdminLiveSoundId = "desk"): boolean {
  if (!readAdminLiveSoundEnabled()) return false;
  const now = Date.now();
  if (!shouldPlayAdminLiveSound(true, 1, lastPlayedAt, now)) return false;
  const ctx = context();
  if (!ctx) return false;
  const origin = ctx.currentTime + 0.01;
  for (const spec of ADMIN_LIVE_SOUND_LIBRARY[id]) {
    voice(ctx, spec, origin);
  }
  lastPlayedAt = now;
  return true;
}

export function resetAdminLivePingForTests(): void {
  lastPlayedAt = 0;
}
