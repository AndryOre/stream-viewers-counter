# Use Streamer.bot as the single source of Readings

The overlay consumes Streamer.bot's WebSocket instead of polling platform APIs from its own backend. It is free, needs no API keys or quotas, and works for any Streamer.bot user. The trade-off is that it runs on the streamer's PC (Windows; Linux and macOS are experimental), not on a server.
