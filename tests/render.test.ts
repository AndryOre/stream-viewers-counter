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

describe("render", () => {
  class FakeClassList {
    private readonly names = new Set<string>();
    add(name: string) {
      this.names.add(name);
    }
    remove(name: string) {
      this.names.delete(name);
    }
    toggle(name: string, force?: boolean) {
      if (force ?? !this.names.has(name)) this.names.add(name);
      else this.names.delete(name);
    }
    contains(name: string) {
      return this.names.has(name);
    }
  }

  class FakeElement {
    className = "";
    textContent = "";
    innerHTML = "";
    dataset: Record<string, string> = {};
    classList = new FakeClassList();
    children: FakeElement[] = [];
    parent: FakeElement | null = null;
    setAttribute() {}
    append(...nodes: FakeElement[]) {
      for (const node of nodes) this.attach(node, this.children.length);
    }
    insertBefore(node: FakeElement, reference: FakeElement) {
      this.attach(node, this.children.indexOf(reference));
    }
    replaceChildren(...nodes: FakeElement[]) {
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
    private attach(node: FakeElement, index: number) {
      node.remove();
      node.parent = this;
      this.children.splice(index, 0, node);
    }
  }

  test("hides the pill and retires platform rows once nothing is live", async () => {
    const timers: Array<() => void> = [];
    Object.assign(globalThis, {
      document: { createElement: () => new FakeElement() },
      window: {
        setTimeout: (callback: () => void) => timers.push(callback),
        clearTimeout: () => {},
      },
      requestAnimationFrame: (callback: (timestamp: number) => void) => {
        callback(performance.now() + 1000);
        return 1;
      },
      cancelAnimationFrame: () => {},
    });
    const { render } = await import("../overlay/render");
    const root = new FakeElement();

    render(
      {
        platforms: [{ platform: "twitch", viewers: 42, stale: false }],
        total: 42,
        anyLive: true,
      },
      root as unknown as HTMLElement,
    );
    const pill = root.children[0] as FakeElement;
    const row = pill.children[0] as FakeElement;
    expect(pill.classList.contains("shown")).toBe(true);
    expect(row.classList.contains("visible")).toBe(true);

    render({ platforms: [], total: 0, anyLive: false }, root as unknown as HTMLElement);
    expect(pill.classList.contains("shown")).toBe(false);
    expect(row.classList.contains("visible")).toBe(false);
    for (const timer of timers) timer();
    expect(pill.children).not.toContain(row);
  });
});
