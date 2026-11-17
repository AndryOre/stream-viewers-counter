import { describe, expect, test } from "bun:test";
import { adapters } from "../overlay/adapters";

const NOW = 5_000;

describe("twitch adapters", () => {
  test("StreamOnline marks twitch live without a count", () => {
    expect(adapters["Twitch.StreamOnline"]?.({}, NOW)).toEqual({
      platform: "twitch",
      key: "default",
      live: true,
      viewers: null,
      receivedAt: NOW,
    });
  });

  test("StreamOffline marks twitch offline", () => {
    expect(adapters["Twitch.StreamOffline"]?.({}, NOW)).toEqual({
      platform: "twitch",
      key: "default",
      live: false,
      viewers: null,
      receivedAt: NOW,
    });
  });

  test("ViewerCountUpdate carries the viewer count", () => {
    expect(adapters["Twitch.ViewerCountUpdate"]?.({ viewers: 42 }, NOW)).toEqual({
      platform: "twitch",
      key: "default",
      live: true,
      viewers: 42,
      receivedAt: NOW,
    });
  });

  test("ViewerCountUpdate with a malformed payload yields no reading", () => {
    expect(adapters["Twitch.ViewerCountUpdate"]?.({ viewers: "many" }, NOW)).toBeNull();
    expect(adapters["Twitch.ViewerCountUpdate"]?.(null, NOW)).toBeNull();
  });
});
