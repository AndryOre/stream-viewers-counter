import { describe, expect, test } from "bun:test";
import { concatenatePoller } from "../overlay/build";
import { findExternalReferences } from "../overlay/dist-check";
import { parseLayout } from "../overlay/layout";
import { interpolate } from "../overlay/render";

describe("parseLayout", () => {
  test("defaults to scale 1 and top-left", () => {
    expect(parseLayout(new URLSearchParams(""))).toEqual({ scale: 1, align: "top-left" });
  });

  test("reads scale and align", () => {
    expect(parseLayout(new URLSearchParams("scale=1.5&align=top-right"))).toEqual({
      scale: 1.5,
      align: "top-right",
    });
  });

  test("rejects invalid values", () => {
    expect(parseLayout(new URLSearchParams("scale=abc&align=middle"))).toEqual({
      scale: 1,
      align: "top-left",
    });
    expect(parseLayout(new URLSearchParams("scale=-2")).scale).toBe(1);
    expect(parseLayout(new URLSearchParams("scale=100")).scale).toBe(5);
  });
});

describe("interpolate", () => {
  test("counts from the old value to the new one", () => {
    expect(interpolate(40, 60, 0)).toBe(40);
    expect(interpolate(40, 60, 0.5)).toBe(50);
    expect(interpolate(40, 60, 1)).toBe(60);
    expect(interpolate(40, 60, 2)).toBe(60);
  });
});

describe("concatenatePoller", () => {
  test("merges usings once and keeps both classes", () => {
    const merged = concatenatePoller(
      "using System;\nusing System.Text.RegularExpressions;\n\npublic static class XBroadcastParser {}\n",
      "using System;\nusing System.Net.Http;\n\npublic partial class CPHInline {}\n",
    );
    expect(merged.match(/^using System;$/gm)).toHaveLength(1);
    expect(merged).toContain("using System.Net.Http;");
    expect(merged).toContain("public static class XBroadcastParser {}");
    expect(merged).toContain("public class CPHInline {}");
    expect(merged).not.toContain("partial");
  });
});

describe("build output", () => {
  test("bun run build emits both files and dist/overlay.html has no external references", async () => {
    const build = Bun.spawn(["bun", "run", "overlay/build.ts"], { stdout: "pipe", stderr: "pipe" });
    expect(await build.exited).toBe(0);

    const html = await Bun.file("dist/overlay.html").text();
    expect(findExternalReferences(html)).toEqual([]);
    expect(html).toContain("@font-face");
    expect(html).not.toContain('src="./index.ts"');

    const poller = await Bun.file("dist/streamerbot/x-poller.cs").text();
    expect(poller).toContain("class XBroadcastParser");
    expect(poller).toContain("class CPHInline");
  });

  test("findExternalReferences flags remote resources only", () => {
    expect(findExternalReferences('<script src="https://cdn.example/x.js"></script>')).not.toEqual(
      [],
    );
    expect(findExternalReferences("a{background:url(//example.com/a.png)}")).not.toEqual([]);
    expect(findExternalReferences("a{src:url(data:font/woff2;base64,AAAA)}")).toEqual([]);
  });
});
