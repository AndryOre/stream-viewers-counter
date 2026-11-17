# Stream Viewers Counter

An OBS overlay that shows which streaming platforms a streamer is live on and the summed viewer count, fed by Streamer.bot.

## Language

**Platform**:
A streaming service the overlay counts: Twitch, YouTube, Kick or X.
_Avoid_: service, site

**Reading**:
One observation of a Platform's live state and viewer count at a moment in time.
_Avoid_: update, stat

**Live Platform**:
A Platform whose latest Reading says it is broadcasting.
_Avoid_: active, online stream

**Stale Platform**:
A Live Platform with no Reading for longer than the stale window.
_Avoid_: offline (offline is reported explicitly)

**Total**:
The sum of viewers across Live Platforms that are not stale.
_Avoid_: views, audience

**X Poller**:
The Streamer.bot action that produces X Readings.
_Avoid_: X scraper bot
