import { describe, expect, mock, test } from "bun:test";
import { adapters } from "../overlay/adapters";
import { createViewerBoard } from "../overlay/board";
import type { Reading } from "../overlay/types";

const NOW = 5_000;

function run(name: string, data: unknown, now = NOW): Reading | null {
  return adapters[name]?.(data, now) ?? null;
}

function makeBoard() {
  let clock = 1_000_000;
  const board = createViewerBoard({ staleAfterMs: 150_000, now: () => clock });
  const feed = (name: string, data: unknown) => {
    const parsed = run(name, data, clock);
    if (parsed) board.apply(parsed);
  };
  return { board, feed, advance: (ms: number) => (clock += ms) };
}

describe("kick adapters", () => {
  test("online, viewer count and offline map to the kick platform", () => {
    expect(run("Kick.StreamOnline", {})).toMatchObject({
      platform: "kick",
      live: true,
      viewers: null,
    });
    expect(run("Kick.ViewerCountUpdate", { viewers: 7 })).toMatchObject({
      platform: "kick",
      live: true,
      viewers: 7,
    });
    expect(run("Kick.StreamOffline", {})).toMatchObject({ platform: "kick", live: false });
  });

  test("a malformed Kick viewer count yields no reading", () => {
    expect(run("Kick.ViewerCountUpdate", {})).toBeNull();
  });
});

describe("youtube adapters", () => {
  test("statistics carry concurrentViewers keyed by broadcast id", () => {
    expect(
      run("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: 15 }),
    ).toEqual({
      platform: "youtube",
      key: "A",
      live: true,
      viewers: 15,
      receivedAt: NOW,
      countOnly: true,
    });
  });

  test("concurrentViewers as a numeric string is accepted", () => {
    expect(
      run("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: "15" }),
    ).toMatchObject({ viewers: 15 });
  });

  test("BroadcastStarted and BroadcastEnded use the broadcast id", () => {
    expect(run("YouTube.BroadcastStarted", { id: "B" })).toMatchObject({
      key: "B",
      live: true,
      viewers: null,
    });
    expect(run("YouTube.BroadcastEnded", { id: "B" })).toMatchObject({ key: "B", live: false });
  });

  test("simultaneous broadcasts A=15 and B=10 show 25", () => {
    const { board, feed } = makeBoard();
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: 15 });
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "B" }, concurrentViewers: 10 });
    expect(board.snapshot().platforms).toEqual([
      { platform: "youtube", viewers: 25, stale: false },
    ]);
    feed("YouTube.BroadcastEnded", { broadcast: { id: "A" } });
    expect(board.snapshot().platforms).toEqual([
      { platform: "youtube", viewers: 10, stale: false },
    ]);
  });

  test("missing viewer field keeps YouTube live with unknown count, excluded from the total", () => {
    const { board, feed } = makeBoard();
    feed("Twitch.ViewerCountUpdate", { viewers: 40 });
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" } });
    expect(board.snapshot()).toEqual({
      platforms: [
        { platform: "twitch", viewers: 40, stale: false },
        { platform: "youtube", viewers: null, stale: false },
      ],
      total: 40,
      anyLive: true,
    });
  });

  test("a late count-less statistics event after BroadcastEnded does not resurrect the broadcast", () => {
    const { board, feed, advance } = makeBoard();
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" } });
    feed("YouTube.BroadcastEnded", { broadcast: { id: "A" } });
    advance(500);
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" } });
    expect(board.snapshot().anyLive).toBe(false);
    advance(200_000);
    expect(board.snapshot().anyLive).toBe(false);
  });

  test("a late viewer event after BroadcastEnded does not resurrect the broadcast", () => {
    const { board, feed, advance } = makeBoard();
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: 15 });
    advance(1000);
    feed("YouTube.BroadcastEnded", { broadcast: { id: "A" } });
    advance(500);
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: 16 });
    expect(board.snapshot().anyLive).toBe(false);
    feed("YouTube.BroadcastStarted", { broadcast: { id: "A" } });
    feed("YouTube.StatisticsUpdated", { broadcast: { id: "A" }, concurrentViewers: 18 });
    expect(board.snapshot().platforms).toEqual([
      { platform: "youtube", viewers: 18, stale: false },
    ]);
  });
});

describe("x custom adapter", () => {
  test("live payload makes X live with its count and joins the total", () => {
    const { board, feed } = makeBoard();
    feed("Twitch.ViewerCountUpdate", { viewers: 1200 });
    feed("General.Custom", {
      event: "x-viewers",
      live: true,
      viewers: 213,
      broadcastId: "2BlQqLoZXadyVk",
    });
    expect(board.snapshot().total).toBe(1413);
  });

  test("live=false hides X", () => {
    const { board, feed } = makeBoard();
    feed("General.Custom", { event: "x-viewers", live: true, viewers: 213, broadcastId: "a" });
    feed("General.Custom", { event: "x-viewers", live: false, viewers: null, broadcastId: null });
    expect(board.snapshot().anyLive).toBe(false);
  });

  test("payloads from other actions are ignored without throwing", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      42,
      "x-viewers",
      [],
      {},
      { event: "other", live: true, viewers: 5 },
      { event: "x-viewers" },
      { event: "x-viewers", live: "yes", viewers: 5 },
      { event: "x-viewers", live: true },
      { event: "x-viewers", live: true, viewers: -3 },
      { event: "x-viewers", live: true, viewers: "lots" },
    ];
    for (const payload of malformed) expect(run("General.Custom", payload)).toBeNull();
  });
});

describe("streamerbot connection", () => {
  test("creates a single client with a de-duplicated subscription and ignores malformed events", async () => {
    const constructed: Record<string, unknown>[] = [];
    mock.module("@streamerbot/client", () => ({
      StreamerbotClient: class {
        constructor(options: Record<string, unknown>) {
          constructed.push(options);
        }
      },
    }));
    const { connectStreamerbot } = await import("../overlay/streamerbot");
    const received: Reading[] = [];
    connectStreamerbot({ host: "127.0.0.1", port: 8080 }, adapters, (entry) =>
      received.push(entry),
    );

    expect(constructed).toHaveLength(1);
    const options = constructed[0] as {
      autoReconnect: boolean;
      subscribe: Record<string, string[]>;
      onData: (payload: unknown) => void;
    };
    expect(options.autoReconnect).toBe(true);
    for (const types of Object.values(options.subscribe)) {
      expect(new Set(types).size).toBe(types.length);
    }
    expect(options.subscribe.General).toEqual(["Custom"]);
    expect(options.subscribe.YouTube).toEqual([
      "BroadcastStarted",
      "StatisticsUpdated",
      "BroadcastEnded",
    ]);

    for (const bad of [null, undefined, {}, { event: {} }, { event: { source: "General" } }, 7]) {
      expect(() => options.onData(bad)).not.toThrow();
    }
    options.onData({ event: { source: "General", type: "Custom" }, data: { foo: 1 } });
    expect(received).toHaveLength(0);
    options.onData({
      event: { source: "General", type: "Custom" },
      data: { event: "x-viewers", live: true, viewers: 213, broadcastId: "a" },
    });
    expect(received).toHaveLength(1);
  });
});
