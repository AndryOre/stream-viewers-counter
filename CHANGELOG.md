# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-18

### Added

- Viewer count overlay with per-platform counts for Twitch, YouTube, Kick and X, plus a Total.
- Stale handling: a platform with no reading for 150 seconds is greyed out and excluded from the Total, and failed or missing readings never show as 0.
- Single-file OBS overlay (`overlay.html`) that connects to Streamer.bot and is fully transparent when no platform is live.
- X Poller Streamer.bot action (`x-poller.cs`) that reads the X live viewer count and broadcasts it to the overlay.

[Unreleased]: https://github.com/AndryOre/stream-viewers-counter/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AndryOre/stream-viewers-counter/releases/tag/v1.0.0
