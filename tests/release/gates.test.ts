import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findReleaseGateProblems, runReleaseGates } from "../../scripts/release/gates";

const CHANGELOG = `# Changelog

## [Unreleased]

## [1.0.0] - 2026-11-18

### Added

- A new thing.

## [0.9.0] - 2026-11-01

### Fixed

[Unreleased]: https://example.test/compare/v1.0.0...HEAD
`;

const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Release Tester",
  GIT_AUTHOR_EMAIL: "release@example.test",
  GIT_COMMITTER_NAME: "Release Tester",
  GIT_COMMITTER_EMAIL: "release@example.test",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};

const SIGNED_TAGS = ["v1.0.0", "1.0.0", "v1.0.0-rc.1", "v1.0.1", "v0.9.0"];

function run(command: string, commandArguments: readonly string[], cwd: string): string {
  const result = spawnSync(command, commandArguments, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...GIT_IDENTITY },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArguments.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function createFixture() {
  const workspace = mkdtempSync(path.join(tmpdir(), "release-gates-"));
  const repository = path.join(workspace, "repository");
  const git = (...commandArguments: string[]) => run("git", commandArguments, repository);
  mkdirSync(repository, { recursive: true });
  writeFileSync(
    path.join(repository, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0" }),
  );
  writeFileSync(path.join(repository, "CHANGELOG.md"), CHANGELOG);
  git("init", "--quiet");
  git("add", ".");
  git("commit", "--quiet", "--no-gpg-sign", "-m", "release 1.0.0");

  const signingKey = path.join(workspace, "signing-key");
  run("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "tester", "-f", signingKey], workspace);
  const publicKey = readFileSync(`${signingKey}.pub`, "utf8").trim();
  const allowedSigners = path.join(workspace, "allowed_signers");
  writeFileSync(allowedSigners, `* ${publicKey}\n`);

  for (const name of SIGNED_TAGS) {
    git(
      "-c",
      "gpg.format=ssh",
      "-c",
      `user.signingkey=${signingKey}`,
      "tag",
      "-s",
      "-m",
      name,
      name,
    );
  }
  git("tag", "-a", "-m", "unsigned", "v1.0.0-unsigned");
  git("tag", "v1.0.0-lightweight");
  return { workspace, repository, allowedSigners };
}

const fixture = createFixture();

function check(tag: string, options: { signers?: string; expectedCommit?: string } = {}): string[] {
  return findReleaseGateProblems({
    tag,
    repositoryRoot: fixture.repository,
    allowedSignersFile: options.signers ?? fixture.allowedSigners,
    environment: GIT_IDENTITY,
    expectedCommit: options.expectedCommit,
  });
}

function runCli(commandArguments: readonly string[]) {
  const errors: string[] = [];
  const code = runReleaseGates(commandArguments, {
    repositoryRoot: fixture.repository,
    environment: GIT_IDENTITY,
    log: () => undefined,
    error: (message) => {
      errors.push(message);
    },
  });
  return { code, errors };
}

afterAll(() => {
  rmSync(fixture.workspace, { recursive: true, force: true });
});

describe("findReleaseGateProblems", () => {
  test("passes a signed, annotated tag that matches the version and has a CHANGELOG section", () => {
    expect(check("v1.0.0")).toEqual([]);
  });

  test("rejects a tag that points at a different commit than the one being released", () => {
    const tagged = run("git", ["rev-list", "-n", "1", "v1.0.0"], fixture.repository).trim();
    const other = "0".repeat(40);

    expect(check("v1.0.0", { expectedCommit: tagged })).toEqual([]);
    expect(check("v1.0.0", { expectedCommit: other })).toEqual([
      `tag v1.0.0 points at ${tagged}, not at the commit being released ${other}`,
    ]);
  });

  test("rejects a lightweight tag", () => {
    expect(check("v1.0.0-lightweight")).toContain(
      "tag v1.0.0-lightweight is a lightweight tag; a release tag is annotated and signed (git tag -s)",
    );
  });

  test("rejects an annotated tag without a signature", () => {
    expect(check("v1.0.0-unsigned")).toContain(
      "tag v1.0.0-unsigned has no valid signature (git tag -v failed)",
    );
  });

  test("rejects a signed tag whose key is not an allowed signer", () => {
    const strangers = path.join(fixture.workspace, "no_signers");
    writeFileSync(strangers, "");

    expect(check("v1.0.0", { signers: strangers })).toEqual([
      "tag v1.0.0 has no valid signature (git tag -v failed)",
    ]);
  });

  test("rejects a tag that differs from the package version", () => {
    expect(check("v1.0.1")).toContain("tag v1.0.1 does not match package.json version 1.0.0");
  });

  test("rejects a tag without the v prefix", () => {
    expect(check("1.0.0")).toContain("tag 1.0.0 does not match package.json version 1.0.0");
  });

  test("rejects a pre-release tag of the same version", () => {
    expect(check("v1.0.0-rc.1")).toContain(
      "tag v1.0.0-rc.1 does not match package.json version 1.0.0",
    );
  });

  test("rejects a tag without a CHANGELOG section", () => {
    expect(check("v1.0.1")).toContain('CHANGELOG.md has no "## [1.0.1]" section');
  });

  test("rejects a tag whose CHANGELOG section is empty", () => {
    expect(check("v0.9.0")).toContain('The "## [0.9.0]" section of CHANGELOG.md is empty');
  });

  test("rejects a tag that does not exist", () => {
    expect(check("v9.9.9")).toContain("tag v9.9.9 does not exist");
  });
});

describe("runReleaseGates", () => {
  test("exits 0 when every gate passes", () => {
    expect(runCli(["v1.0.0", "--allowed-signers", fixture.allowedSigners])).toEqual({
      code: 0,
      errors: [],
    });
  });

  test("exits 1 and names each failed gate", () => {
    const { code, errors } = runCli([
      "v1.0.0-lightweight",
      "--allowed-signers",
      fixture.allowedSigners,
    ]);

    expect(code).toBe(1);
    expect(errors).toContain(
      "release-gates: tag v1.0.0-lightweight is a lightweight tag; a release tag is annotated and signed (git tag -s)",
    );
  });

  const malformedArguments: readonly (readonly string[])[] = [
    [],
    ["v1.0.0", "extra"],
    ["v1.0.0", "--allowed-signers"],
  ];

  test.each(malformedArguments.map((commandArguments) => [commandArguments]))(
    "exits 1 with the usage line for %j",
    (commandArguments) => {
      expect(runCli(commandArguments)).toEqual({
        code: 1,
        errors: ["Usage: bun scripts/release/gates.ts <tag> [--allowed-signers <file>]"],
      });
    },
  );
});
