public class CphApi
{
    public T GetGlobalVar<T>(string name, bool persisted = true) { return default(T); }
    public void LogWarn(string message) { }
    public void WebsocketBroadcastJson(string json) { }
}

public partial class CPHInline
{
    public CphApi CPH = new CphApi();
}
