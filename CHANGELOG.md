# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-11-18

### Added

- `style` option with a minimal look: one row with the total first and small logos, no numbers.
- `layout`, `labels` and `counts` options to choose a vertical or horizontal row and to show or hide the Total word and each platform number.
- `color`, `bg`, `opacity`, `font` and `radius` options to change the text color, background color, background opacity, font and corner radius.

### Changed

- README images: normal and minimal screenshots, shown small.
- README options guide: a table of every setting, copy-paste examples and OBS Custom CSS examples (English and Spanish).

## [1.0.0] - 2026-11-18

### Added

- Viewer count overlay with per-platform counts for Twitch, YouTube, Kick and X, plus a Total.
- Stale handling: a platform with no reading for 150 seconds is greyed out and excluded from the Total, and failed or missing readings never show as 0.
- Single-file OBS overlay (`overlay.html`) that connects to Streamer.bot and is fully transparent when no platform is live.
- X Poller Streamer.bot action (`x-poller.cs`) that reads the X live viewer count and broadcasts it to the overlay.

[Unreleased]: https://github.com/AndryOre/stream-viewers-counter/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/AndryOre/stream-viewers-counter/releases/tag/v1.1.0
[1.0.0]: https://github.com/AndryOre/stream-viewers-counter/releases/tag/v1.0.0
