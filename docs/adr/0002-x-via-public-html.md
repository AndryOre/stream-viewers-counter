# Read X viewers from public HTML in a Streamer.bot action

X's official Livestream API is paid and gated, and Streamer.bot has no X integration. The X Poller therefore reads the logged-out server-rendered HTML of x.com inside a C# action. The markup is undocumented and may change, so failures surface as a Stale Platform, never as a zero.
