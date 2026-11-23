using System.Text.Json;

namespace PersonalSpaceStudio;

// No paths, shell commands, credentials or authoring operations cross this boundary.
internal static class Boundary
{
    internal static bool Root(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme == "http" && uri.Host == "127.0.0.1" && uri.Port > 0
        && uri.UserInfo == "" && uri.AbsolutePath == "/" && uri.Query == "" && uri.Fragment == "";
    internal static bool SameRoot(string origin, string value) => Root(value) && value == origin + "/";
    internal static bool Fields(JsonElement value, params string[] names) => value.ValueKind == JsonValueKind.Object
        && value.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(names.Order());
    internal static bool Id(string? value) => Guid.TryParseExact(value, "D", out _);
    internal static bool Boot(JsonElement value) => Fields(value, "type", "version") && Text(value,"type") == "studio:boot"
        && Text(value,"version") is string version && version.Length == 64 && version.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    internal static string? Text(JsonElement value, string key) => value.TryGetProperty(key, out var item)
        && item.ValueKind == JsonValueKind.String ? item.GetString() : null;
    internal static bool PrivateSelection(JsonElement value) => Fields(value, "type", "requestId", "mode")
        && Text(value, "type") == "studio:private-select" && Id(Text(value, "requestId"))
        && Text(value, "mode") is "open" or "create" or "export";
    internal static bool Resource(string origin, string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme is "data" or "about") return true;
        if (uri.GetLeftPart(UriPartial.Authority) == origin) return true;
        var prefix = "blob:" + origin + "/";
        return uri.Scheme == "blob" && value.StartsWith(prefix, StringComparison.Ordinal)
            && Guid.TryParseExact(value[prefix.Length..], "D", out _);
    }
}
