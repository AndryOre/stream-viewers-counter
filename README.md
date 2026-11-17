# Stream Viewers Counter

An OBS browser-source overlay that shows live viewer counts for Twitch, YouTube, Kick and X, plus a combined Total. Data comes from Streamer.bot over its WebSocket server; there is no other server component.

When no platform is live the overlay is fully transparent. A platform with no reading for 150 seconds is greyed out and excluded from the Total. Failed or missing readings never show as 0.

## Build

```sh
bun install
bun run build
```

This writes:

- `dist/overlay.html`: a single self-contained file (JS, CSS, icons and the Inter font inlined, no external requests).
- `dist/streamerbot/x-poller.cs`: the X Poller, ready to paste into a Streamer.bot C# action.

## Setup

### 1. Streamer.bot WebSocket server

1. In Streamer.bot open **Servers/Clients > WebSocket Server**.
2. Keep address `127.0.0.1` and port `8080` (or pick your own), enable **Auto Start**, and start the server.
3. If you set a password, pass it to the overlay with `?password=`.

### 2. Platform connections

Connect your accounts under **Platforms** in Streamer.bot. The overlay listens to:

| Platform | Events                                                                         |
| -------- | ------------------------------------------------------------------------------ |
| Twitch   | `Twitch.StreamOnline`, `Twitch.StreamOffline`, `Twitch.ViewerCountUpdate`      |
| YouTube  | `YouTube.BroadcastStarted`, `YouTube.StatisticsUpdated`, `YouTube.BroadcastEnded` |
| Kick     | `Kick.StreamOnline`, `Kick.StreamOffline`, `Kick.ViewerCountUpdate`            |
| X        | `General.Custom` with the X Poller payload                                     |

Several simultaneous YouTube broadcasts are summed by broadcast id. If YouTube hides the concurrent viewer count, the platform is shown without a number and is left out of the Total.

### 3. X Poller

X has no API access here, so a Streamer.bot action reads the public logged-out page.

1. Create a global variable named `xHandle` containing your X handle (for example `serudda`).
2. Create an action named `X Poller`, add a **Execute C# Code** sub-action, paste the contents of `dist/streamerbot/x-poller.cs`, then click **Compile**.
3. Under **Timed Actions**, add one that runs `X Poller` every 60 seconds.

The action broadcasts `{"event":"x-viewers","live":true,"viewers":N,"broadcastId":"..."}` through `CPH.WebsocketBroadcastJson`. On a fetch or parse failure it logs a warning and broadcasts nothing, so the overlay falls back to its stale rules.

### 4. OBS browser source

1. Add a **Browser** source.
2. Tick **Local file** and select `dist/overlay.html`.
3. Set width and height to your canvas size (for example 1920x1080) and keep the background transparent.

## Query parameters

Append them to the local file path as a query string, for example `file:///path/to/overlay.html?scale=1.5&align=top-right` (or enter a URL if you host the file).

| Parameter   | Default     | Description                                                              |
| ----------- | ----------- | ------------------------------------------------------------------------ |
| `host`      | `127.0.0.1` | Streamer.bot WebSocket host                                              |
| `port`      | `8080`      | Streamer.bot WebSocket port                                              |
| `password`  | none        | Streamer.bot WebSocket password                                          |
| `scale`     | `1`         | Size multiplier (0.25 to 5)                                              |
| `align`     | `top-left`  | `top-left`, `top-right`, `bottom-left` or `bottom-right`                 |

The overlay reconnects automatically when Streamer.bot restarts, and restores the last board from `localStorage` after a reload.

## Development

```sh
bun run check   # typecheck, oxlint, oxfmt
bun test        # unit tests, including a build smoke test
```

The X Poller parser has its own .NET tests: `streamerbot/test.sh`.
