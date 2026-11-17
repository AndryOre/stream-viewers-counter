import type { BoardSnapshot, PlatformId } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

const PLACEHOLDER_ICONS: Record<PlatformId, { color: string; label: string }> = {
  twitch: { color: "#9146ff", label: "Twitch" },
  youtube: { color: "#ff0000", label: "YouTube" },
  kick: { color: "#53fc18", label: "Kick" },
  x: { color: "#ffffff", label: "X" },
};

export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const [divisor, suffix] = value >= 1_000_000 ? [1_000_000, "m"] : [1000, "k"];
  const scaled = Math.floor((value / (divisor ?? 1)) * 10) / 10;
  return `${scaled}${suffix}`;
}

function createIcon(platform: PlatformId): SVGSVGElement {
  const { color, label } = PLACEHOLDER_ICONS[platform];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");
  circle.setAttribute("fill", color);
  svg.append(circle);
  return svg;
}

function createText(className: string, text: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

export function render(snapshot: BoardSnapshot, root: HTMLElement): void {
  root.replaceChildren();
  if (!snapshot.anyLive) return;

  const pill = document.createElement("div");
  pill.className = "pill";

  for (const platform of snapshot.platforms) {
    const row = document.createElement("div");
    row.className = platform.stale ? "platform stale" : "platform";
    row.dataset.platform = platform.platform;
    row.append(
      createIcon(platform.platform),
      createText("count", platform.viewers === null ? "–" : formatCount(platform.viewers)),
    );
    pill.append(row);
  }

  const total = document.createElement("div");
  total.className = "total";
  total.append(
    createText("total-label", "Total"),
    createText("total-count", formatCount(snapshot.total)),
  );
  pill.append(total);

  root.append(pill);
}
