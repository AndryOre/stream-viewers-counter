using System.IO;
using Xunit;

public class XBroadcastParserTests
{
    private static string Fixture(string name)
    {
        return File.ReadAllText(Path.Combine(System.AppContext.BaseDirectory, "fixtures", name));
    }

    [Fact]
    public void LiveProfileYieldsRunningBroadcastId()
    {
        Assert.Equal("2BlQqLoZXadyVk", XBroadcastParser.FindRunningBroadcastId(Fixture("x-profile-live.html")));
    }

    [Fact]
    public void LiveBroadcastPageYieldsWatching()
    {
        Assert.Equal(213, XBroadcastParser.ParseWatching(Fixture("x-broadcast-live.html")));
    }

    [Fact]
    public void LiveBroadcastPageYieldsBroadcastId()
    {
        Assert.Equal("2BlQqLoZXadyVk", XBroadcastParser.FindRunningBroadcastId(Fixture("x-broadcast-live.html")));
    }

    [Fact]
    public void OfflineProfileHasNoBroadcast()
    {
        var html = Fixture("x-profile-offline.html");
        Assert.Null(XBroadcastParser.FindRunningBroadcastId(html));
        Assert.Null(XBroadcastParser.ParseWatching(html));
    }

    [Fact]
    public void ProfileFixturesAreRecognisedAsProfilePages()
    {
        Assert.True(XBroadcastParser.IsProfilePage(Fixture("x-profile-live.html")));
        Assert.True(XBroadcastParser.IsProfilePage(Fixture("x-profile-offline.html")));
        Assert.False(XBroadcastParser.IsProfilePage("<html>login wall</html>"));
        Assert.False(XBroadcastParser.IsProfilePage(null));
    }

    [Fact]
    public void PicksRunningAmongSeveralBroadcasts()
    {
        var html = "{\\\"broadcast_id\\\":\\\"OLD1\\\",\\\"state\\\":\\\"Ended\\\",\\\"total_watching\\\":0}"
            + "{\\\"broadcast_id\\\":\\\"LIVE2\\\",\\\"state\\\":\\\"Running\\\",\\\"total_watching\\\":7}"
            + "{\\\"broadcast_id\\\":\\\"OLD3\\\",\\\"state\\\":\\\"Ended\\\",\\\"total_watching\\\":0}";
        Assert.Equal("LIVE2", XBroadcastParser.FindRunningBroadcastId(html));
    }

    [Fact]
    public void OnlyEndedBroadcastsMeansNone()
    {
        var html = "{\\\"broadcast_id\\\":\\\"OLD1\\\",\\\"state\\\":\\\"Ended\\\"}";
        Assert.Null(XBroadcastParser.FindRunningBroadcastId(html));
    }

    [Fact]
    public void UnescapedJsonIsAlsoParsed()
    {
        var html = "{\"broadcast_id\":\"ABC\",\"state\":\"Running\",\"total_watching\":42}";
        Assert.Equal("ABC", XBroadcastParser.FindRunningBroadcastId(html));
        Assert.Equal(42, XBroadcastParser.ParseWatching(html));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("<html><body>garbage {\\\"broadcast_id\\\":")]
    [InlineData("\\\"total_watching\\\":abc")]
    public void MalformedInputYieldsNull(string html)
    {
        Assert.Null(XBroadcastParser.FindRunningBroadcastId(html));
        Assert.Null(XBroadcastParser.ParseWatching(html));
    }

    [Fact]
    public void WatchingOverflowYieldsNull()
    {
        Assert.Null(XBroadcastParser.ParseWatching("\"total_watching\":99999999999999"));
    }
}
