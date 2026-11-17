import { describe, expect, test } from "bun:test";
import { createViewerBoard, persistBoard, restoreBoard } from "../overlay/board";
import type { Reading } from "../overlay/types";

const STALE_MS = 150_000;

function makeBoard(start = 1_000_000) {
  let clock = start;
  const board = createViewerBoard({ staleAfterMs: STALE_MS, now: () => clock });
  return {
    board,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

function reading(overrides: Partial<Reading>): Reading {
  return {
    platform: "twitch",
    key: "default",
    live: true,
    viewers: 42,
    receivedAt: 1_000_000,
    ...overrides,
  };
}

describe("ViewerBoard", () => {
  test("empty board is not live and has no total", () => {
    const { board } = makeBoard();
    expect(board.snapshot()).toEqual({ platforms: [], total: null, anyLive: false });
  });

  test("a live reading shows the platform and contributes to the total", () => {
    const { board } = makeBoard();
    board.apply(reading({ viewers: 42 }));
    expect(board.snapshot()).toEqual({
      platforms: [{ platform: "twitch", viewers: 42, stale: false }],
      total: 42,
      anyLive: true,
    });
  });

  test("an offline reading hides the platform", () => {
    const { board } = makeBoard();
    board.apply(reading({ viewers: 42 }));
    board.apply(reading({ live: false, viewers: null }));
    expect(board.snapshot().anyLive).toBe(false);
    expect(board.snapshot().platforms).toEqual([]);
  });

  test("online without a count shows null, never 0", () => {
    const { board } = makeBoard();
    board.apply(reading({ viewers: null }));
    const snapshot = board.snapshot();
    expect(snapshot.platforms[0]?.viewers).toBeNull();
    expect(snapshot.total).toBeNull();
    expect(snapshot.anyLive).toBe(true);
  });

  test("a viewer-less reading keeps the last known count", () => {
    const { board } = makeBoard();
    board.apply(reading({ viewers: 42 }));
    board.apply(reading({ viewers: null }));
    expect(board.snapshot().platforms[0]?.viewers).toBe(42);
  });

  test("broadcasts of one platform are summed by key", () => {
    const { board } = makeBoard();
    board.apply(reading({ platform: "youtube", key: "A", viewers: 15 }));
    board.apply(reading({ platform: "youtube", key: "B", viewers: 10 }));
    expect(board.snapshot().platforms).toEqual([
      { platform: "youtube", viewers: 25, stale: false },
    ]);
    board.apply(reading({ platform: "youtube", key: "A", live: false, viewers: null }));
    expect(board.snapshot().platforms[0]?.viewers).toBe(10);
  });

  test("total sums across platforms", () => {
    const { board } = makeBoard();
    board.apply(reading({ platform: "twitch", viewers: 1200 }));
    board.apply(reading({ platform: "x", viewers: 213 }));
    expect(board.snapshot().total).toBe(1413);
  });

  test("a late count after an offline event does not resurrect the platform", () => {
    const { board } = makeBoard();
    board.apply(reading({ viewers: 42, receivedAt: 1_000_000 }));
    board.apply(reading({ live: false, viewers: null, receivedAt: 1_010_000 }));
    board.apply(reading({ viewers: 50, receivedAt: 1_015_000 }));
    expect(board.snapshot().anyLive).toBe(false);
  });

  test("an online event after offline brings the platform back", () => {
    const { board } = makeBoard();
    board.apply(reading({ live: false, viewers: null, receivedAt: 1_010_000 }));
    board.apply(reading({ viewers: null, receivedAt: 1_015_000 }));
    expect(board.snapshot().anyLive).toBe(true);
  });

  test("a count long after the offline event is accepted again", () => {
    const { board } = makeBoard();
    board.apply(reading({ live: false, viewers: null, receivedAt: 1_000_000 }));
    board.apply(reading({ viewers: 7, receivedAt: 1_060_000 }));
    expect(board.snapshot().platforms[0]?.viewers).toBe(7);
  });

  test("total is null when every live platform is stale", () => {
    const { board, advance } = makeBoard();
    board.apply(reading({ viewers: 42, receivedAt: 1_000_000 }));
    advance(151_000);
    const snapshot = board.snapshot();
    expect(snapshot.platforms[0]?.stale).toBe(true);
    expect(snapshot.total).toBeNull();
  });

  test("a platform past the stale window is stale and excluded from the total", () => {
    const { board, advance } = makeBoard();
    board.apply(reading({ platform: "twitch", viewers: 42, receivedAt: 1_000_000 }));
    board.apply(reading({ platform: "x", viewers: 10, receivedAt: 1_100_000 }));
    advance(151_000);
    const snapshot = board.snapshot();
    expect(snapshot.platforms).toEqual([
      { platform: "twitch", viewers: 42, stale: true },
      { platform: "x", viewers: 10, stale: false },
    ]);
    expect(snapshot.total).toBe(10);
    expect(snapshot.anyLive).toBe(true);
  });

  test("exactly at the stale window is still fresh", () => {
    const { board, advance } = makeBoard();
    board.apply(reading({ receivedAt: 1_000_000 }));
    advance(STALE_MS);
    expect(board.snapshot().platforms[0]?.stale).toBe(false);
  });

  test("a fresh reading revives a stale platform", () => {
    const { board, advance, now } = makeBoard();
    board.apply(reading({ receivedAt: now() }));
    advance(200_000);
    board.apply(reading({ viewers: 50, receivedAt: now() }));
    expect(board.snapshot().platforms[0]).toEqual({
      platform: "twitch",
      viewers: 50,
      stale: false,
    });
  });
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("board persistence", () => {
  test("restores readings still inside the stale window", () => {
    const storage = memoryStorage();
    persistBoard(storage, [reading({ viewers: 42, receivedAt: 1_000_000 })]);
    expect(restoreBoard(storage, 1_030_000)).toEqual([
      reading({ viewers: 42, receivedAt: 1_000_000 }),
    ]);
  });

  test("drops readings outside the stale window", () => {
    const storage = memoryStorage();
    persistBoard(storage, [reading({ receivedAt: 1_000_000 })]);
    expect(restoreBoard(storage, 1_000_000 + STALE_MS + 1)).toEqual([]);
  });

  test("restore ignores unknown platforms, negative counts and future timestamps", () => {
    const storage = memoryStorage();
    storage.setItem(
      "viewer-board",
      JSON.stringify([
        { ...reading({}), platform: "foo" },
        reading({ viewers: -5 }),
        reading({ receivedAt: 2_000_000 }),
        reading({ viewers: 8, receivedAt: 1_000_000 }),
      ]),
    );
    expect(restoreBoard(storage, 1_010_000)).toEqual([reading({ viewers: 8 })]);
  });

  test("corrupt storage restores nothing", () => {
    const storage = memoryStorage();
    storage.setItem("viewer-board", "{nope");
    expect(restoreBoard(storage, 1_000_000)).toEqual([]);
  });
});
