import type { BoardSnapshot, PlatformId, PlatformSnapshot, Reading } from "./types";

const STORAGE_KEY = "viewer-board";
const STALE_AFTER_MS = 150_000;
const OFFLINE_GRACE_MS = 30_000;
const PLATFORM_IDS: readonly string[] = ["twitch", "youtube", "kick", "x"];

interface BoardOptions {
  staleAfterMs: number;
  now: () => number;
}

export interface ViewerBoard {
  apply(reading: Reading): void;
  snapshot(): BoardSnapshot;
  readings(): Reading[];
}

function sumViewers(readings: Reading[]): number | null {
  const counted = readings.filter((entry) => entry.viewers !== null);
  if (counted.length === 0) return null;
  return counted.reduce((sum, entry) => sum + (entry.viewers ?? 0), 0);
}

export function createViewerBoard(options: BoardOptions): ViewerBoard {
  const entries = new Map<string, Reading>();
  const offlineAt = new Map<string, number>();

  const entryId = (reading: Reading) => `${reading.platform}:${reading.key}`;

  function apply(reading: Reading): void {
    const id = entryId(reading);
    if (!reading.live) {
      entries.delete(id);
      offlineAt.set(id, reading.receivedAt);
      return;
    }
    const wentOfflineAt = offlineAt.get(id);
    if (wentOfflineAt !== undefined) {
      const isCountOnly = reading.viewers !== null;
      if (isCountOnly && reading.receivedAt - wentOfflineAt <= OFFLINE_GRACE_MS) return;
      offlineAt.delete(id);
    }
    const previous = entries.get(id);
    entries.set(id, {
      ...reading,
      viewers: reading.viewers ?? previous?.viewers ?? null,
    });
  }

  function snapshot(): BoardSnapshot {
    const now = options.now();
    const byPlatform = new Map<PlatformId, Reading[]>();
    for (const reading of entries.values()) {
      const group = byPlatform.get(reading.platform) ?? [];
      group.push(reading);
      byPlatform.set(reading.platform, group);
    }

    const platforms: PlatformSnapshot[] = [];
    let total: number | null = null;
    for (const [platform, group] of byPlatform) {
      const fresh = group.filter((entry) => now - entry.receivedAt <= options.staleAfterMs);
      const stale = fresh.length === 0;
      const viewers = sumViewers(stale ? group : fresh);
      if (!stale && viewers !== null) total = (total ?? 0) + viewers;
      platforms.push({ platform, viewers, stale });
    }
    return { platforms, total, anyLive: platforms.length > 0 };
  }

  return { apply, snapshot, readings: () => [...entries.values()] };
}

export function persistBoard(storage: Storage, readings: Reading[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(readings));
  } catch (error) {
    console.warn("Could not persist board", error);
  }
}

function isReading(value: unknown, now: number): value is Reading {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.platform === "string" &&
    PLATFORM_IDS.includes(candidate.platform) &&
    typeof candidate.key === "string" &&
    typeof candidate.live === "boolean" &&
    (candidate.viewers === null ||
      (typeof candidate.viewers === "number" &&
        Number.isFinite(candidate.viewers) &&
        candidate.viewers >= 0)) &&
    typeof candidate.receivedAt === "number" &&
    Number.isFinite(candidate.receivedAt) &&
    candidate.receivedAt <= now
  );
}

export function restoreBoard(storage: Storage, now: number): Reading[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => isReading(entry, now))
      .filter((reading) => now - reading.receivedAt <= STALE_AFTER_MS);
  } catch (error) {
    console.warn("Could not restore board", error);
    return [];
  }
}

export { OFFLINE_GRACE_MS, STALE_AFTER_MS };
