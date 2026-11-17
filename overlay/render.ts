import { ICON_MARKUP, PLATFORM_LABELS } from "./icons";
import type { BoardSnapshot, PlatformId } from "./types";

export const ANIMATION_MS = 300;
const PLATFORM_ORDER: readonly PlatformId[] = ["twitch", "youtube", "kick", "x"];
const UNKNOWN_COUNT = "–";

export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const [divisor, suffix] = value >= 1_000_000 ? [1_000_000, "m"] : [1000, "k"];
  const scaled = Math.floor((value / (divisor ?? 1)) * 10) / 10;
  return `${scaled}${suffix}`;
}

export function interpolate(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * clamped);
}

interface Counter {
  element: HTMLElement;
  shown: number | null;
  frame: number | null;
}

interface PlatformRow {
  row: HTMLElement;
  counter: Counter;
  removal: number | null;
}

interface BoardView {
  pill: HTMLElement;
  total: HTMLElement;
  totalCounter: Counter;
  rows: Map<PlatformId, PlatformRow>;
}

const views = new WeakMap<HTMLElement, BoardView>();

function createText(className: string, text: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function createCounter(className: string): Counter {
  return { element: createText(className, UNKNOWN_COUNT), shown: null, frame: null };
}

function setCount(counter: Counter, target: number | null): void {
  if (counter.frame !== null) {
    cancelAnimationFrame(counter.frame);
    counter.frame = null;
  }
  const from = counter.shown;
  if (target === null || from === null || from === target) {
    counter.shown = target;
    counter.element.textContent = target === null ? UNKNOWN_COUNT : formatCount(target);
    return;
  }
  const startedAt = performance.now();
  const step = (timestamp: number) => {
    const progress = (timestamp - startedAt) / ANIMATION_MS;
    counter.shown = interpolate(from, target, progress);
    counter.element.textContent = formatCount(counter.shown);
    counter.frame = progress >= 1 ? null : requestAnimationFrame(step);
  };
  counter.frame = requestAnimationFrame(step);
}

function createView(root: HTMLElement): BoardView {
  const pill = document.createElement("div");
  pill.className = "pill";
  const totalCounter = createCounter("total-count");
  const total = document.createElement("div");
  total.className = "total";
  total.append(createText("total-label", "Total"), totalCounter.element);
  pill.append(total);
  root.replaceChildren(pill);
  return { pill, total, totalCounter, rows: new Map() };
}

function createRow(platform: PlatformId, view: BoardView): PlatformRow {
  const row = document.createElement("div");
  row.className = "platform";
  row.dataset.platform = platform;
  row.setAttribute("aria-label", PLATFORM_LABELS[platform]);
  const icon = document.createElement("span");
  icon.className = "icon-slot";
  icon.innerHTML = ICON_MARKUP[platform];
  const counter = createCounter("count");
  row.append(icon, counter.element);

  const position = PLATFORM_ORDER.indexOf(platform);
  const next = [...view.rows.entries()]
    .filter(([other]) => PLATFORM_ORDER.indexOf(other) > position)
    .sort(([a], [b]) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b))[0];
  view.pill.insertBefore(row, next ? next[1].row : view.total);

  requestAnimationFrame(() => row.classList.add("visible"));
  return { row, counter, removal: null };
}

function retire(platform: PlatformId, entry: PlatformRow, view: BoardView): void {
  if (entry.removal !== null) return;
  entry.row.classList.remove("visible");
  entry.removal = window.setTimeout(() => {
    if (entry.counter.frame !== null) cancelAnimationFrame(entry.counter.frame);
    entry.row.remove();
    if (view.rows.get(platform) === entry) view.rows.delete(platform);
  }, ANIMATION_MS);
}

export function render(snapshot: BoardSnapshot, root: HTMLElement): void {
  const view = views.get(root) ?? createView(root);
  views.set(root, view);

  view.pill.classList.toggle("shown", snapshot.anyLive);

  const present = new Set<PlatformId>();
  for (const platform of snapshot.platforms) {
    present.add(platform.platform);
    let entry = view.rows.get(platform.platform);
    if (entry?.removal != null) {
      window.clearTimeout(entry.removal);
      entry.removal = null;
      entry.row.classList.add("visible");
    }
    if (!entry) {
      entry = createRow(platform.platform, view);
      view.rows.set(platform.platform, entry);
    }
    entry.row.classList.toggle("stale", platform.stale);
    setCount(entry.counter, platform.viewers);
  }

  for (const [platform, entry] of view.rows) {
    if (!present.has(platform)) retire(platform, entry, view);
  }

  setCount(view.totalCounter, snapshot.total);
}
