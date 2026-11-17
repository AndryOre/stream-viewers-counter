import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../overlay/index.html", import.meta.url), "utf8");

describe("overlay stylesheet contract", () => {
  test.each([
    ["--text-color", "#fff"],
    ["--pill-bg", "rgba(0, 0, 0, 0.55)"],
    ["--font-family", '"Inter", system-ui, sans-serif'],
    ["--pill-radius", "16px"],
  ])("%s keeps today's value as fallback", (variable, fallback) => {
    expect(css).toContain(`var(${variable}, ${fallback})`);
  });

  test.each([
    ".layout-horizontal .pill",
    ".hide-counts .platform .count",
    ".hide-labels .total-label",
    ".layout-horizontal.hide-counts .total",
  ])("defines the %s selector", (selector) => {
    expect(css).toContain(selector);
  });

  test("minimal look puts the total first and caps wide logos", () => {
    expect(css).toMatch(/\.layout-horizontal\.hide-counts \.total\s*{[^}]*order:\s*-1/);
    expect(css).toMatch(/max-width:\s*56px/);
  });

  test("hide-counts hides only the count, not the platform row", () => {
    expect(css).not.toMatch(/\.hide-counts \.platform\s*{/);
    expect(css).toMatch(/\.hide-counts \.platform \.count\s*{[^}]*display:\s*none/);
  });
});
