import { describe, expect, mock, test } from "bun:test";
import { readSection } from "../../scripts/release/changelog";
import { releaseNotes, runReleaseNotes } from "../../scripts/release/notes";

const CHANGELOG = `# Changelog

## [Unreleased]

## [2.4.0] - 2026-11-11

### Added

- A new thing.

## [2.3.1] - 2026-11-03

### Fixed

## [2.3.0] - 2026-11-03

- Older.

[Unreleased]: https://example.test/compare/v2.4.0...HEAD
[2.4.0]: https://example.test/compare/v2.3.1...v2.4.0
`;

const LAST_SECTION_CHANGELOG = `# Changelog

## [1.0.0] - 2026-11-18

### Added

- First release.

[Unreleased]: https://example.test/compare/v1.0.0...HEAD
[1.0.0]: https://example.test/releases/tag/v1.0.0
`;

function streams() {
  return {
    notes: mock<(text: string) => void>(),
    error: mock<(message: string) => void>(),
  };
}

describe("readSection", () => {
  test("finds a section whose heading carries a date", () => {
    expect(readSection(CHANGELOG, "2.4.0")).toEqual({
      status: "found",
      body: "### Added\n\n- A new thing.",
    });
  });

  test("ends a section at the next section heading", () => {
    const lookup = readSection(CHANGELOG, "2.3.0");

    expect(lookup).toEqual({ status: "found", body: "- Older." });
  });

  test("ends the last section before the trailing link references", () => {
    expect(readSection(LAST_SECTION_CHANGELOG, "1.0.0")).toEqual({
      status: "found",
      body: "### Added\n\n- First release.",
    });
  });

  test("reports a section with only empty subsections as empty", () => {
    expect(readSection(CHANGELOG, "2.3.1")).toEqual({ status: "empty" });
  });

  test("reports an unknown version as missing", () => {
    expect(readSection(CHANGELOG, "9.9.9")).toEqual({ status: "missing" });
  });

  test("does not match a version prefix", () => {
    expect(readSection(CHANGELOG, "2.3")).toEqual({ status: "missing" });
  });
});

describe("releaseNotes", () => {
  test("returns the section body for the tag", () => {
    expect(releaseNotes("v2.4.0", CHANGELOG)).toBe("### Added\n\n- A new thing.");
  });

  test("fails when the tag has no section", () => {
    expect(() => releaseNotes("v9.9.9", CHANGELOG)).toThrow(
      'CHANGELOG.md has no "## [9.9.9]" section',
    );
  });

  test("fails when the section is empty", () => {
    expect(() => releaseNotes("v2.3.1", CHANGELOG)).toThrow(
      'The "## [2.3.1]" section of CHANGELOG.md is empty',
    );
  });

  test("never falls back to the Unreleased section", () => {
    expect(() => releaseNotes("vUnreleased", CHANGELOG)).toThrow(/is empty/);
  });
});

describe("runReleaseNotes", () => {
  test("writes the notes and exits 0", () => {
    const output = streams();

    expect(runReleaseNotes(["v2.3.0"], () => CHANGELOG, output)).toBe(0);
    expect(output.notes).toHaveBeenCalledWith("- Older.");
    expect(output.error).not.toHaveBeenCalled();
  });

  test("exits 1 naming the missing section and writes no notes", () => {
    const output = streams();

    expect(runReleaseNotes(["v9.9.9"], () => CHANGELOG, output)).toBe(1);
    expect(output.notes).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith(
      'release-notes: CHANGELOG.md has no "## [9.9.9]" section',
    );
  });

  test("exits 1 on an empty section", () => {
    expect(runReleaseNotes(["v2.3.1"], () => CHANGELOG, streams())).toBe(1);
  });

  test.each([[[]], [["v2.4.0", "extra"]]])("exits 1 with usage for arguments %j", (args) => {
    const output = streams();

    expect(runReleaseNotes(args, () => CHANGELOG, output)).toBe(1);
    expect(output.error).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  test("lets an unexpected failure surface", () => {
    const failure = new Error("disk gone");

    expect(() =>
      runReleaseNotes(
        ["v2.4.0"],
        () => {
          throw failure;
        },
        streams(),
      ),
    ).toThrow(failure);
  });
});
