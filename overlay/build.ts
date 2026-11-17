import { mkdir } from "node:fs/promises";
import { findExternalReferences } from "./dist-check";

const FONT_WEIGHTS = [400, 700] as const;
const FONT_MARKER = "/*__INTER_FONT_FACE__*/";

async function buildFontFaces(): Promise<string> {
  const faces = await Promise.all(
    FONT_WEIGHTS.map(async (weight) => {
      const path = `overlay/fonts/inter-latin-${weight}-normal.woff2`;
      const encoded = (await Bun.file(path).bytes()).toBase64();
      return `@font-face{font-family:"Inter";font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${encoded}) format("woff2")}`;
    }),
  );
  return faces.join("\n");
}

async function buildOverlay(): Promise<string> {
  const result = await Bun.build({
    entrypoints: ["overlay/index.ts"],
    target: "browser",
    format: "iife",
    minify: true,
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  const [output] = result.outputs;
  if (!output) throw new Error("Bundle produced no output");

  const script = (await output.text()).replaceAll("</script", "<\\/script");
  const template = await Bun.file("overlay/index.html").text();
  const scriptTag = /<script[^>]*src="\.\/index\.ts"[^>]*><\/script>/;
  if (!scriptTag.test(template)) throw new Error("Script tag not found in overlay/index.html");
  if (!template.includes(FONT_MARKER))
    throw new Error("Font marker not found in overlay/index.html");

  const fonts = await buildFontFaces();
  const html = template
    .replace(FONT_MARKER, () => fonts)
    .replace(scriptTag, () => `<script>${script}</script>`);

  const external = findExternalReferences(html);
  if (external.length > 0) {
    throw new Error(`dist/overlay.html references external resources: ${external.join(", ")}`);
  }
  return html;
}

export function concatenatePoller(parser: string, action: string): string {
  const usings = new Set<string>();
  const bodies = [parser, action].map((source) =>
    source
      .split(/\r?\n/)
      .filter((line) => {
        if (!/^using\s+[\w.]+;\s*$/.test(line)) return true;
        usings.add(line.trim());
        return false;
      })
      .join("\n")
      .trim(),
  );
  const body = bodies
    .join("\n\n")
    .replace("public partial class CPHInline", "public class CPHInline");
  return `${[...usings].sort().join("\n")}\n\n${body}\n`;
}

async function buildPoller(): Promise<string> {
  const parser = await Bun.file("streamerbot/x-poller/XBroadcastParser.cs").text();
  const action = await Bun.file("streamerbot/x-poller/XPoller.cs").text();
  return concatenatePoller(parser, action);
}

if (import.meta.main) {
  const [html, poller] = await Promise.all([buildOverlay(), buildPoller()]);
  await mkdir("dist/streamerbot", { recursive: true });
  await Bun.write("dist/overlay.html", html);
  await Bun.write("dist/streamerbot/x-poller.cs", poller);
  console.log(`dist/overlay.html written (${html.length} bytes)`);
  console.log(`dist/streamerbot/x-poller.cs written (${poller.length} bytes)`);
}
