export type Align = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Layout {
  scale: number;
  align: Align;
}

const ALIGNMENTS: readonly Align[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const MIN_SCALE = 0.25;
const MAX_SCALE = 5;

export function parseLayout(params: URLSearchParams): Layout {
  const scale = Number(params.get("scale"));
  const align = params.get("align");
  return {
    scale:
      params.get("scale") !== null && Number.isFinite(scale) && scale > 0
        ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
        : 1,
    align: ALIGNMENTS.find((candidate) => candidate === align) ?? "top-left",
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
}
