const LINK_DEFINITION = /^\[[^\]]+\]:\s/;

export class ChangelogError extends Error {
  override readonly name = "ChangelogError";
}

export type SectionLookup =
  | { readonly status: "missing" }
  | { readonly status: "empty" }
  | { readonly status: "found"; readonly body: string };

function hasContent(line: string): boolean {
  return line.trim() !== "";
}

function findSectionBody(lines: readonly string[], version: string): string[] | undefined {
  const headingIndex = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (headingIndex === -1) return undefined;
  const rest = lines.slice(headingIndex + 1);
  const length = rest.findIndex((line) => line.startsWith("## [") || LINK_DEFINITION.test(line));
  return length === -1 ? rest : rest.slice(0, length);
}

function dropEmptySubsections(body: readonly string[]): string[] {
  const kept: string[] = [];
  let subsection: string[] = [];
  const flush = () => {
    const [first = "", ...rest] = subsection;
    if (!first.startsWith("### ") || rest.some((line) => hasContent(line))) {
      kept.push(...subsection);
    }
    subsection = [];
  };
  for (const line of body) {
    if (line.startsWith("### ")) flush();
    subsection.push(line);
  }
  flush();
  return kept;
}

function trimBlankEdges(lines: readonly string[]): string[] {
  const first = lines.findIndex((line) => hasContent(line));
  if (first === -1) return [];
  const lastFromEnd = [...lines].reverse().findIndex((line) => hasContent(line));
  return lines.slice(first, lines.length - lastFromEnd);
}

export function readSection(changelog: string, version: string): SectionLookup {
  const section = findSectionBody(changelog.split("\n"), version);
  if (!section) return { status: "missing" };
  const body = trimBlankEdges(dropEmptySubsections(section));
  return body.length === 0 ? { status: "empty" } : { status: "found", body: body.join("\n") };
}
