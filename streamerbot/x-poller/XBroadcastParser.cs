using System.Globalization;
using System.Text.RegularExpressions;

public static class XBroadcastParser
{
    private static readonly Regex BroadcastIdMarker = new Regex("\"broadcast_id\":\"([A-Za-z0-9]+)\"");
    private static readonly Regex RunningState = new Regex("\"state\":\"Running\"");
    private static readonly Regex Watching = new Regex("\"total_watching\":(\\d+)");

    private static string Normalize(string html)
    {
        return html.Replace("\\\"", "\"");
    }

    public static string FindRunningBroadcastId(string html)
    {
        if (string.IsNullOrEmpty(html))
        {
            return null;
        }

        var text = Normalize(html);
        var markers = BroadcastIdMarker.Matches(text);
        for (var index = 0; index < markers.Count; index++)
        {
            var start = markers[index].Index + markers[index].Length;
            var end = index + 1 < markers.Count ? markers[index + 1].Index : text.Length;
            if (RunningState.IsMatch(text.Substring(start, end - start)))
            {
                return markers[index].Groups[1].Value;
            }
        }

        return null;
    }

    public static bool IsProfilePage(string html)
    {
        return !string.IsNullOrEmpty(html) && html.Contains("twitter://user?screen_name=");
    }

    public static int? ParseWatching(string html)
    {
        if (string.IsNullOrEmpty(html))
        {
            return null;
        }

        var match = Watching.Match(Normalize(html));
        if (!match.Success)
        {
            return null;
        }

        int value;
        if (int.TryParse(match.Groups[1].Value, NumberStyles.None, CultureInfo.InvariantCulture, out value))
        {
            return value;
        }

        return null;
    }
}
