import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ChangelogError } from "./changelog";
import { releaseNotes } from "./notes";

const USAGE = "Usage: bun scripts/release/gates.ts <tag> [--allowed-signers <file>]";
const MANIFEST_PATH = "package.json";

export interface ReleaseGateInput {
  readonly tag: string;
  readonly repositoryRoot: string;
  readonly allowedSignersFile?: string | undefined;
  readonly environment?: Readonly<Record<string, string>> | undefined;
  readonly expectedCommit?: string | undefined;
}

function runGit(input: ReleaseGateInput, commandArguments: readonly string[]) {
  const signerConfig =
    input.allowedSignersFile === undefined
      ? []
      : ["-c", `gpg.ssh.allowedSignersFile=${input.allowedSignersFile}`];
  return spawnSync("git", [...signerConfig, ...commandArguments], {
    cwd: input.repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...input.environment },
  });
}

function findTagProblems(input: ReleaseGateInput): string[] {
  const { tag } = input;
  const objectType = runGit(input, ["cat-file", "-t", `refs/tags/${tag}`]);
  if (objectType.status !== 0) return [`tag ${tag} does not exist`];
  if (objectType.stdout.trim() !== "tag") {
    return [`tag ${tag} is a lightweight tag; a release tag is annotated and signed (git tag -s)`];
  }
  if (runGit(input, ["tag", "-v", tag]).status !== 0) {
    return [`tag ${tag} has no valid signature (git tag -v failed)`];
  }
  if (input.expectedCommit === undefined) return [];
  const taggedCommit = runGit(input, ["rev-list", "-n", "1", `refs/tags/${tag}`]).stdout.trim();
  return taggedCommit === input.expectedCommit
    ? []
    : [
        `tag ${tag} points at ${taggedCommit}, not at the commit being released ${input.expectedCommit}`,
      ];
}

function readManifestVersion(repositoryRoot: string): string {
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(repositoryRoot, MANIFEST_PATH), "utf8"),
  );
  const version =
    typeof manifest === "object" && manifest !== null && "version" in manifest
      ? manifest.version
      : undefined;
  if (typeof version !== "string") throw new TypeError(`${MANIFEST_PATH} has no version string`);
  return version;
}

function findVersionProblems(input: ReleaseGateInput): string[] {
  const version = readManifestVersion(input.repositoryRoot);
  return input.tag === `v${version}`
    ? []
    : [`tag ${input.tag} does not match ${MANIFEST_PATH} version ${version}`];
}

function findChangelogProblems(input: ReleaseGateInput): string[] {
  const changelog = readFileSync(path.join(input.repositoryRoot, "CHANGELOG.md"), "utf8");
  try {
    releaseNotes(input.tag, changelog);
    return [];
  } catch (error) {
    if (error instanceof ChangelogError) return [error.message];
    throw error;
  }
}

export function findReleaseGateProblems(input: ReleaseGateInput): string[] {
  return [
    ...findTagProblems(input),
    ...findVersionProblems(input),
    ...findChangelogProblems(input),
  ];
}

export interface ReleaseGateRunContext {
  readonly repositoryRoot: string;
  readonly environment?: Readonly<Record<string, string>> | undefined;
  readonly expectedCommit?: string | undefined;
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

function parseArguments(
  commandArguments: readonly string[],
): { tag: string; allowedSignersFile: string | undefined } | undefined {
  const [tag, flag, file, ...extra] = commandArguments;
  if (tag === undefined || tag.startsWith("-") || extra.length > 0) return undefined;
  if (flag === undefined) return { tag, allowedSignersFile: undefined };
  if (flag !== "--allowed-signers" || file === undefined) return undefined;
  return { tag, allowedSignersFile: file };
}

export function runReleaseGates(
  commandArguments: readonly string[],
  context: ReleaseGateRunContext,
): number {
  const parsed = parseArguments(commandArguments);
  if (parsed === undefined) {
    context.error(USAGE);
    return 1;
  }
  const problems = findReleaseGateProblems({
    ...parsed,
    repositoryRoot: context.repositoryRoot,
    environment: context.environment,
    expectedCommit: context.expectedCommit,
  });
  for (const problem of problems) context.error(`release-gates: ${problem}`);
  if (problems.length > 0) return 1;
  context.log(`release-gates: tag ${parsed.tag} is signed, annotated, versioned and noted`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = runReleaseGates(process.argv.slice(2), {
    repositoryRoot: path.resolve(import.meta.dirname, "../.."),
    expectedCommit: process.env.GITHUB_SHA,
    log: (message) => {
      console.log(message);
    },
    error: (message) => {
      console.error(message);
    },
  });
}
