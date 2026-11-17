export type PlatformId = "twitch" | "youtube" | "kick" | "x";

export interface Reading {
  platform: PlatformId;
  key: string;
  live: boolean;
  viewers: number | null;
  receivedAt: number;
}

export interface PlatformSnapshot {
  platform: PlatformId;
  viewers: number | null;
  stale: boolean;
}

export interface BoardSnapshot {
  platforms: PlatformSnapshot[];
  total: number | null;
  anyLive: boolean;
}

export type EventAdapter = (data: unknown, now: number) => Reading | null;
