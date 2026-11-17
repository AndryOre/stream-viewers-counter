import type { EventAdapter, PlatformId, Reading } from "./types";

function reading(
  platform: PlatformId,
  live: boolean,
  viewers: number | null,
  now: number,
  key = "default",
): Reading {
  return { platform, key, live, viewers, receivedAt: now };
}

function readViewers(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const viewers = (data as Record<string, unknown>).viewers;
  return typeof viewers === "number" && Number.isFinite(viewers) && viewers >= 0 ? viewers : null;
}

export const adapters: Record<string, EventAdapter> = {
  "Twitch.StreamOnline": (_data, now) => reading("twitch", true, null, now),
  "Twitch.StreamOffline": (_data, now) => reading("twitch", false, null, now),
  "Twitch.ViewerCountUpdate": (data, now) => {
    const viewers = readViewers(data);
    return viewers === null ? null : reading("twitch", true, viewers, now);
  },
};
