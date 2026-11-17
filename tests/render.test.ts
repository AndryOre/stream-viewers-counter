import { describe, expect, test } from "bun:test";
import { formatCount } from "../overlay/render";

describe("formatCount", () => {
  test("keeps small numbers as-is", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  test("compacts thousands", () => {
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(1413)).toBe("1.4k");
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(12_500)).toBe("12.5k");
  });

  test("compacts millions", () => {
    expect(formatCount(1_500_000)).toBe("1.5m");
  });
});
