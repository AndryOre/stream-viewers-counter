import { mkdir } from "node:fs/promises";

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

const html = template.replace(scriptTag, () => `<script>${script}</script>`);
await mkdir("dist", { recursive: true });
await Bun.write("dist/overlay.html", html);
console.log(`dist/overlay.html written (${html.length} bytes)`);
