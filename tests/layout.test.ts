import { describe, expect, test } from "bun:test";
import { applyLayout, parseLayout } from "../overlay/layout";

const parse = (query: string) => parseLayout(new URLSearchParams(query));

function fakeRoot() {
  const classes = new Set<string>();
  const variables = new Map<string, string>();
  const style: Record<string, unknown> = {
    setProperty: (name: string, value: string) => variables.set(name, value),
  };
  const classList = {
    toggle: (name: string, force?: boolean) => {
      if (force) classes.add(name);
      else classes.delete(name);
      return Boolean(force);
    },
  };
  return { root: { style, classList } as unknown as HTMLElement, classes, variables, style };
}

describe("scale and align", () => {
  test("defaults", () => {
    expect(parse("")).toMatchObject({ scale: 1, align: "top-left" });
  });

  test("clamps scale to 0.25-5", () => {
    expect(parse("scale=10").scale).toBe(5);
    expect(parse("scale=0.1").scale).toBe(0.25);
    expect(parse("scale=2").scale).toBe(2);
  });

  test("invalid scale falls back to 1", () => {
    expect(parse("scale=abc").scale).toBe(1);
    expect(parse("scale=0").scale).toBe(1);
    expect(parse("scale=-2").scale).toBe(1);
  });

  test("accepts known alignments only", () => {
    expect(parse("align=bottom-right").align).toBe("bottom-right");
    expect(parse("align=middle").align).toBe("top-left");
  });
});

describe("style, layout, labels, counts", () => {
  test("defaults are full, vertical, labels and counts on", () => {
    expect(parse("")).toMatchObject({
      style: "full",
      layout: "vertical",
      labels: "on",
      counts: "on",
    });
  });

  test("minimal implies horizontal, labels off, counts off", () => {
    expect(parse("style=minimal")).toMatchObject({
      style: "minimal",
      layout: "horizontal",
      labels: "off",
      counts: "off",
    });
  });

  test("explicit options win over minimal", () => {
    expect(parse("style=minimal&layout=vertical")).toMatchObject({
      layout: "vertical",
      labels: "off",
      counts: "off",
    });
    expect(parse("style=minimal&labels=on&counts=on")).toMatchObject({
      layout: "horizontal",
      labels: "on",
      counts: "on",
    });
  });

  test("explicit options apply on full style", () => {
    expect(parse("layout=horizontal&labels=off&counts=off")).toMatchObject({
      style: "full",
      layout: "horizontal",
      labels: "off",
      counts: "off",
    });
  });

  test("unknown values fall back to defaults", () => {
    expect(parse("style=huge&layout=diagonal&labels=maybe&counts=1")).toMatchObject({
      style: "full",
      layout: "vertical",
      labels: "on",
      counts: "on",
    });
  });

  test("invalid explicit values do not override minimal", () => {
    expect(parse("style=minimal&layout=diagonal")).toMatchObject({ layout: "horizontal" });
  });
});

describe("colors, opacity, radius", () => {
  test("defaults", () => {
    expect(parse("")).toMatchObject({
      textColor: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.55)",
      radius: 16,
    });
  });

  test("spec scenario", () => {
    expect(parse("color=ff0000&bg=112233&opacity=0.8&radius=8")).toMatchObject({
      textColor: "#ff0000",
      backgroundColor: "rgba(17,34,51,0.8)",
      radius: 8,
    });
  });

  test("expands 3-digit hex", () => {
    expect(parse("color=f0a&bg=0af")).toMatchObject({
      textColor: "#ff00aa",
      backgroundColor: "rgba(0,170,255,0.55)",
    });
  });

  test("accepts uppercase hex", () => {
    expect(parse("color=FF00AA").textColor).toBe("#ff00aa");
  });

  test("rejects invalid colors, including injection payloads", () => {
    expect(parse("color=red;}body{display:none").textColor).toBe("#ffffff");
    expect(parse("color=ff00").textColor).toBe("#ffffff");
    expect(parse("color=%23ff0000").textColor).toBe("#ffffff");
    expect(parse("bg=000;}").backgroundColor).toBe("rgba(0,0,0,0.55)");
    expect(parse("bg=url(x)").backgroundColor).toBe("rgba(0,0,0,0.55)");
    expect(parse("color=ggg").textColor).toBe("#ffffff");
  });

  test("opacity range 0-1", () => {
    expect(parse("opacity=0").backgroundColor).toBe("rgba(0,0,0,0)");
    expect(parse("opacity=1").backgroundColor).toBe("rgba(0,0,0,1)");
    expect(parse("opacity=1.5").backgroundColor).toBe("rgba(0,0,0,0.55)");
    expect(parse("opacity=-0.1").backgroundColor).toBe("rgba(0,0,0,0.55)");
    expect(parse("opacity=abc").backgroundColor).toBe("rgba(0,0,0,0.55)");
    expect(parse("opacity=").backgroundColor).toBe("rgba(0,0,0,0.55)");
  });

  test("radius range 0-48", () => {
    expect(parse("radius=0").radius).toBe(0);
    expect(parse("radius=48").radius).toBe(48);
    expect(parse("radius=49").radius).toBe(16);
    expect(parse("radius=-1").radius).toBe(16);
    expect(parse("radius=abc").radius).toBe(16);
    expect(parse("radius=").radius).toBe(16);
  });
});

describe("font", () => {
  const defaultStack = '"Inter", system-ui, sans-serif';

  test("default stack", () => {
    expect(parse("").fontFamily).toBe(defaultStack);
  });

  test("custom font keeps Inter as fallback", () => {
    expect(parse("font=Comic Sans MS").fontFamily).toBe(
      '"Comic Sans MS", "Inter", system-ui, sans-serif',
    );
    expect(parse("font=Roboto-Mono").fontFamily).toBe(
      '"Roboto-Mono", "Inter", system-ui, sans-serif',
    );
  });

  test("rejects injection payloads", () => {
    expect(parse("font=Arial;}").fontFamily).toBe(defaultStack);
    expect(parse('font=Arial"; color: red').fontFamily).toBe(defaultStack);
    expect(parse("font=Arial'}body{display:none").fontFamily).toBe(defaultStack);
    expect(parse("font=a\\b").fontFamily).toBe(defaultStack);
    expect(parse("font=<script>").fontFamily).toBe(defaultStack);
  });

  test("rejects empty and over-long names", () => {
    expect(parse("font=").fontFamily).toBe(defaultStack);
    expect(parse(`font=${"a".repeat(60)}`).fontFamily).toContain("a".repeat(60));
    expect(parse(`font=${"a".repeat(61)}`).fontFamily).toBe(defaultStack);
  });

  test("spec scenario", () => {
    const layout = parse("color=red;}body{display:none&font=Arial;}");
    expect(layout.textColor).toBe("#ffffff");
    expect(layout.fontFamily).toBe(defaultStack);
  });
});

describe("applyLayout", () => {
  test("defaults add no class and set today's variables", () => {
    const { root, classes, variables } = fakeRoot();
    applyLayout(root, parse(""));
    expect([...classes]).toEqual([]);
    expect(variables.get("--text-color")).toBe("#ffffff");
    expect(variables.get("--pill-bg")).toBe("rgba(0,0,0,0.55)");
    expect(variables.get("--font-family")).toBe('"Inter", system-ui, sans-serif');
    expect(variables.get("--pill-radius")).toBe("16px");
  });

  test("minimal adds the three classes", () => {
    const { root, classes } = fakeRoot();
    applyLayout(root, parse("style=minimal"));
    expect([...classes].sort()).toEqual(["hide-counts", "hide-labels", "layout-horizontal"]);
  });

  test("explicit options override minimal classes", () => {
    const { root, classes } = fakeRoot();
    applyLayout(root, parse("style=minimal&layout=vertical&counts=on"));
    expect([...classes]).toEqual(["hide-labels"]);
  });

  test("sets custom variables", () => {
    const { root, variables } = fakeRoot();
    applyLayout(root, parse("color=ff0000&bg=112233&opacity=0.8&radius=8&font=Arial"));
    expect(variables.get("--text-color")).toBe("#ff0000");
    expect(variables.get("--pill-bg")).toBe("rgba(17,34,51,0.8)");
    expect(variables.get("--font-family")).toBe('"Arial", "Inter", system-ui, sans-serif');
    expect(variables.get("--pill-radius")).toBe("8px");
  });

  test("keeps scale and align behavior", () => {
    const { root, style } = fakeRoot();
    applyLayout(root, parse("scale=2&align=bottom-right"));
    expect(style.top).toBe("auto");
    expect(style.bottom).toBe("16px");
    expect(style.left).toBe("auto");
    expect(style.right).toBe("16px");
    expect(style.transformOrigin).toBe("right bottom");
    expect(style.transform).toBe("scale(2)");
    expect(style.alignItems).toBe("flex-end");
  });

  test("clears classes when options turn off", () => {
    const { root, classes } = fakeRoot();
    applyLayout(root, parse("style=minimal"));
    applyLayout(root, parse(""));
    expect([...classes]).toEqual([]);
  });
});
