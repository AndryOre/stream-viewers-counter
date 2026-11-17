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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asViewerCount(value: unknown): number | null {
  const candidate = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
    ? candidate
    : null;
}

function readViewers(data: unknown): number | null {
  return asViewerCount(asRecord(data)?.viewers);
}

function readBroadcastKey(data: unknown): string {
  const record = asRecord(data);
  const candidates = [asRecord(record?.broadcast)?.id, record?.broadcastId, record?.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate !== "") return candidate;
  }
  return "default";
}

function readConcurrentViewers(data: unknown): number | null {
  const record = asRecord(data);
  return (
    asViewerCount(record?.concurrentViewers) ??
    asViewerCount(asRecord(record?.statistics)?.concurrentViewers) ??
    asViewerCount(asRecord(record?.broadcast)?.concurrentViewers)
  );
}

function viewerCountPlatform(platform: PlatformId, label: string): Record<string, EventAdapter> {
  return {
    [`${label}.StreamOnline`]: (_data, now) => reading(platform, true, null, now),
    [`${label}.StreamOffline`]: (_data, now) => reading(platform, false, null, now),
    [`${label}.ViewerCountUpdate`]: (data, now) => {
      const viewers = readViewers(data);
      return viewers === null ? null : reading(platform, true, viewers, now);
    },
  };
}

const xViewers: EventAdapter = (data, now) => {
  const payload = asRecord(data);
  if (payload?.event !== "x-viewers") return null;
  if (payload.live === false) return reading("x", false, null, now);
  if (payload.live !== true) return null;
  const viewers = asViewerCount(payload.viewers);
  return viewers === null ? null : reading("x", true, viewers, now);
};

export const adapters: Record<string, EventAdapter> = {
  ...viewerCountPlatform("twitch", "Twitch"),
  ...viewerCountPlatform("kick", "Kick"),
  "YouTube.BroadcastStarted": (data, now) =>
    reading("youtube", true, null, now, readBroadcastKey(data)),
  "YouTube.StatisticsUpdated": (data, now) =>
    reading("youtube", true, readConcurrentViewers(data), now, readBroadcastKey(data)),
  "YouTube.BroadcastEnded": (data, now) =>
    reading("youtube", false, null, now, readBroadcastKey(data)),
  "General.Custom": xViewers,
};
