using System;
using System.Globalization;
using System.Net.Http;

public partial class CPHInline
{
    private static readonly HttpClient Http = CreateClient();
    private static string cachedBroadcastId;

    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        return client;
    }

    private static string Fetch(string url)
    {
        return Http.GetStringAsync(url).GetAwaiter().GetResult();
    }

    private static string BuildPayload(bool live, int? viewers, string broadcastId)
    {
        var viewersJson = viewers.HasValue ? viewers.Value.ToString(CultureInfo.InvariantCulture) : "null";
        var idJson = broadcastId == null ? "null" : "\"" + broadcastId + "\"";
        return "{\"event\":\"x-viewers\",\"live\":" + (live ? "true" : "false")
            + ",\"viewers\":" + viewersJson + ",\"broadcastId\":" + idJson + "}";
    }

    private bool TryReadKnownBroadcast(out int viewers)
    {
        viewers = 0;
        if (cachedBroadcastId == null)
        {
            return false;
        }

        var page = Fetch("https://x.com/i/broadcasts/" + cachedBroadcastId);
        var watching = XBroadcastParser.ParseWatching(page);
        if (XBroadcastParser.FindRunningBroadcastId(page) == cachedBroadcastId && watching.HasValue)
        {
            viewers = watching.Value;
            return true;
        }

        cachedBroadcastId = null;
        return false;
    }

    public bool Execute()
    {
        try
        {
            var handle = CPH.GetGlobalVar<string>("xHandle");
            if (string.IsNullOrWhiteSpace(handle))
            {
                CPH.LogWarn("X poller: global variable xHandle is not set");
                return false;
            }

            handle = handle.Trim().TrimStart('@');

            int knownViewers;
            if (TryReadKnownBroadcast(out knownViewers))
            {
                CPH.WebsocketBroadcastJson(BuildPayload(true, knownViewers, cachedBroadcastId));
                return true;
            }

            var profile = Fetch("https://x.com/" + Uri.EscapeDataString(handle));
            if (!XBroadcastParser.IsProfilePage(profile))
            {
                CPH.LogWarn("X poller: profile page for " + handle + " was not recognised");
                return false;
            }

            var broadcastId = XBroadcastParser.FindRunningBroadcastId(profile);
            if (broadcastId == null)
            {
                cachedBroadcastId = null;
                CPH.WebsocketBroadcastJson(BuildPayload(false, null, null));
                return true;
            }

            var broadcastPage = Fetch("https://x.com/i/broadcasts/" + broadcastId);
            var watching = XBroadcastParser.ParseWatching(broadcastPage);
            if (!watching.HasValue)
            {
                CPH.LogWarn("X poller: could not read total_watching for broadcast " + broadcastId);
                return false;
            }

            cachedBroadcastId = broadcastId;
            CPH.WebsocketBroadcastJson(BuildPayload(true, watching, broadcastId));
            return true;
        }
        catch (Exception error)
        {
            CPH.LogWarn("X poller failed: " + error.Message);
            return false;
        }
    }
}
