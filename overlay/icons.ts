import kick from "./icons/kick.svg" with { type: "text" };
import twitch from "./icons/twitch.svg" with { type: "text" };
import x from "./icons/x.svg" with { type: "text" };
import youtube from "./icons/youtube.svg" with { type: "text" };
import type { PlatformId } from "./types";

function prepare(svg: string): string {
  return svg.trim().replace(/<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\sxmlns(:\w+)?="[^"]*"/g, "")
      .replace(/\s(width|height)="[^"]*"/g, "")
      .replace("<svg", '<svg class="icon" role="img"'),
  );
}

export const ICON_MARKUP: Record<PlatformId, string> = {
  twitch: prepare(twitch),
  youtube: prepare(youtube),
  kick: prepare(kick),
  x: prepare(x),
};

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
  x: "X",
};
