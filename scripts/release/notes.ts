import { readFileSync } from "node:fs";
import path from "node:path";

import { ChangelogError, readSection } from "./changelog";

export function releaseNotes(tag: string, changelog: string): string {
  const version = tag.replace(/^v/, "");
  const section = readSection(changelog, version);
  if (section.status === "missing") {
    throw new ChangelogError(`CHANGELOG.md has no "## [${version}]" section`);
  }
  if (section.status === "empty") {
    throw new ChangelogError(`The "## [${version}]" section of CHANGELOG.md is empty`);
  }
  return section.body;
}

export function runReleaseNotes(
  commandArguments: readonly string[],
  readChangelog: () => string,
  output: { notes: (text: string) => void; error: (message: string) => void },
): number {
  const [tag, ...extra] = commandArguments;
  if (!tag || extra.length > 0) {
    output.error("Usage: bun scripts/release/notes.ts <tag>");
    return 1;
  }
  try {
    output.notes(releaseNotes(tag, readChangelog()));
    return 0;
  } catch (error) {
    if (error instanceof ChangelogError) {
      output.error(`release-notes: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

if (import.meta.main) {
  process.exitCode = runReleaseNotes(
    process.argv.slice(2),
    () => readFileSync(path.resolve(import.meta.dirname, "../../CHANGELOG.md"), "utf8"),
    {
      notes: (text) => {
        console.log(text);
      },
      error: (message) => {
        console.error(message);
      },
    },
  );
}
