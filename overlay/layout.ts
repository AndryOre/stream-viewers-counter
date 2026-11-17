export type Align = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Style = "full" | "minimal";
export type Direction = "vertical" | "horizontal";
export type Toggle = "on" | "off";

export interface Layout {
  scale: number;
  align: Align;
  style: Style;
  layout: Direction;
  labels: Toggle;
  counts: Toggle;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  radius: number;
}

const ALIGNMENTS: readonly Align[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const MAX_RADIUS = 48;
const DEFAULT_RADIUS = 16;
const DEFAULT_OPACITY = 0.55;
const DEFAULT_TEXT_COLOR = "ffffff";
const DEFAULT_BACKGROUND_COLOR = "000000";
const DEFAULT_FONT_STACK = '"Inter", system-ui, sans-serif';
const FONT_NAME_PATTERN = /^[A-Za-z0-9 -]{1,60}$/;
const HEX_PATTERN = /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHex(value: string | null, fallback: string): string {
  const hex = value !== null && HEX_PATTERN.test(value) ? value.toLowerCase() : fallback;
  return hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
}

function parseOpacity(value: string | null): number {
  const parsed = parseNumber(value);
  return parsed !== undefined && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_OPACITY;
}

function parseRadius(value: string | null): number {
  const parsed = parseNumber(value);
  return parsed !== undefined && parsed >= 0 && parsed <= MAX_RADIUS ? parsed : DEFAULT_RADIUS;
}

function parseFontFamily(value: string | null): string {
  if (value === null) return DEFAULT_FONT_STACK;
  const name = value.trim();
  return FONT_NAME_PATTERN.test(name) ? `"${name}", ${DEFAULT_FONT_STACK}` : DEFAULT_FONT_STACK;
}

function toRgba(hex: string, opacity: number): string {
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
}

export function parseLayout(params: URLSearchParams): Layout {
  const scale = Number(params.get("scale"));
  const align = params.get("align");
  const style = oneOf(params.get("style"), ["full", "minimal"] as const) ?? "full";
  const minimal = style === "minimal";
  return {
    scale:
      params.get("scale") !== null && Number.isFinite(scale) && scale > 0
        ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
        : 1,
    align: ALIGNMENTS.find((candidate) => candidate === align) ?? "top-left",
    style,
    layout:
      oneOf(params.get("layout"), ["vertical", "horizontal"] as const) ??
      (minimal ? "horizontal" : "vertical"),
    labels: oneOf(params.get("labels"), ["on", "off"] as const) ?? (minimal ? "off" : "on"),
    counts: oneOf(params.get("counts"), ["on", "off"] as const) ?? (minimal ? "off" : "on"),
    textColor: `#${parseHex(params.get("color"), DEFAULT_TEXT_COLOR)}`,
    backgroundColor: toRgba(
      parseHex(params.get("bg"), DEFAULT_BACKGROUND_COLOR),
      parseOpacity(params.get("opacity")),
    ),
    fontFamily: parseFontFamily(params.get("font")),
    radius: parseRadius(params.get("radius")),
  };
}

export function applyLayout(root: HTMLElement, layout: Layout): void {
  const [vertical, horizontal] = layout.align.split("-");
  root.style.top = vertical === "top" ? "16px" : "auto";
  root.style.bottom = vertical === "bottom" ? "16px" : "auto";
  root.style.left = horizontal === "left" ? "16px" : "auto";
  root.style.right = horizontal === "right" ? "16px" : "auto";
  root.style.transformOrigin = `${horizontal} ${vertical}`;
  root.style.transform = `scale(${layout.scale})`;
  root.style.alignItems = horizontal === "right" ? "flex-end" : "flex-start";
  root.classList.toggle("layout-horizontal", layout.layout === "horizontal");
  root.classList.toggle("hide-counts", layout.counts === "off");
  root.classList.toggle("hide-labels", layout.labels === "off");
  root.style.setProperty("--text-color", layout.textColor);
  root.style.setProperty("--pill-bg", layout.backgroundColor);
  root.style.setProperty("--font-family", layout.fontFamily);
  root.style.setProperty("--pill-radius", `${layout.radius}px`);
}
