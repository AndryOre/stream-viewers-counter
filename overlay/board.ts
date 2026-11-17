import type { BoardSnapshot, PlatformId, PlatformSnapshot, Reading } from "./types";

const STORAGE_KEY = "viewer-board";
const STALE_AFTER_MS = 150_000;

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

  const entryId = (reading: Reading) => `${reading.platform}:${reading.key}`;

  function apply(reading: Reading): void {
    const id = entryId(reading);
    if (!reading.live) {
      entries.delete(id);
      return;
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
    let total = 0;
    for (const [platform, group] of byPlatform) {
      const fresh = group.filter((entry) => now - entry.receivedAt <= options.staleAfterMs);
      const stale = fresh.length === 0;
      const viewers = sumViewers(stale ? group : fresh);
      if (!stale) total += viewers ?? 0;
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

function isReading(value: unknown): value is Reading {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.platform === "string" &&
    typeof candidate.key === "string" &&
    typeof candidate.live === "boolean" &&
    (candidate.viewers === null || typeof candidate.viewers === "number") &&
    typeof candidate.receivedAt === "number"
  );
}

export function restoreBoard(storage: Storage, now: number): Reading[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReading).filter((reading) => now - reading.receivedAt <= STALE_AFTER_MS);
  } catch (error) {
    console.warn("Could not restore board", error);
    return [];
  }
}

export { STALE_AFTER_MS };
