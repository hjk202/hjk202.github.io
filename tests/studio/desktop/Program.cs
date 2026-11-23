using System.Text.Json;
using PersonalSpaceStudio;

var origin = "http://127.0.0.1:4322";
foreach (var url in new[] { "https://example.com/", "http://localhost:4322/", origin + "/preview", origin + "/?x=1", origin + "/#x", "http://user@127.0.0.1:4322/", "file:///tmp/a", "about:srcdoc", "http://127.0.0.1:4323/" })
    if (Boundary.SameRoot(origin, url)) throw new Exception("Untrusted source accepted");
if (!Boundary.SameRoot(origin, origin + "/")) throw new Exception("Trusted root rejected");
if (Boundary.Id("token") || !Boundary.Id(Guid.NewGuid().ToString("D"))) throw new Exception("Bad lifecycle ID validation");
foreach (var text in new[] { "[]", "null", "{\"type\":\"x\",\"path\":\"C:/\"}", "{\"type\":\"x\",\"type\":\"y\"}" }) {
    using var json = JsonDocument.Parse(text);
    if (Boundary.Fields(json.RootElement, "type")) throw new Exception("Unexpected fields accepted");
}
using (var json = JsonDocument.Parse("{\"type\":\"studio:editor-ready\"}"))
    if (!Boundary.Fields(json.RootElement, "type") || Boundary.Text(json.RootElement, "type") != "studio:editor-ready") throw new Exception("Valid ready rejected");
Console.WriteLine("Desktop origin, message fields and ID boundary checks passed.");
using(var valid=JsonDocument.Parse(JsonSerializer.Serialize(new {type="studio:boot",version=new string('a',64)})))
    if(!Boundary.Boot(valid.RootElement))throw new Exception("Prepared boot rejected");
foreach(var value in new object[]{new {type="studio:boot",version="bad"},new {type="studio:boot",version=new string('a',64),origin="http://127.0.0.1:4322"},new {type="studio:boot",version=new string('A',64)}}){
    using var invalid=JsonDocument.Parse(JsonSerializer.Serialize(value));if(Boundary.Boot(invalid.RootElement))throw new Exception("Unsafe boot accepted");
}
Console.WriteLine("Prepared early-window boot accepts version only; no window opened.");

var selectionId = Guid.NewGuid().ToString("D");
foreach (var mode in new[] { "open", "create", "export" }) {
    using var valid = JsonDocument.Parse(JsonSerializer.Serialize(new { type = "studio:private-select", requestId = selectionId, mode }));
    if (!Boundary.PrivateSelection(valid.RootElement)) throw new Exception("Valid private selection rejected");
}
foreach (var value in new object[] {
    new { type = "studio:private-select", requestId = selectionId, mode = "open", path = "C:/outside.json" },
    new { type = "studio:private-select", requestId = selectionId, mode = "open", password = "NON_SENSITIVE" },
    new { type = "studio:private-select", requestId = "not-an-id", mode = "open" },
    new { type = "studio:private-select", requestId = selectionId, mode = "arbitrary" },
}) {
    using var invalid = JsonDocument.Parse(JsonSerializer.Serialize(value));
    if (Boundary.PrivateSelection(invalid.RootElement)) throw new Exception("Unsafe private selection accepted");
}
Console.WriteLine("Private file-selection field boundary checks passed; no dialog opened.");

var blob = "blob:" + origin + "/" + Guid.NewGuid().ToString("D");
if (!Boundary.Resource(origin, blob) || !Boundary.Resource(origin, origin + "/studio-assets/main.js")) throw new Exception("Owned resource rejected");
foreach (var unsafeUrl in new[] { "blob:http://127.0.0.1:4323/" + Guid.NewGuid(), blob + "?extra=1", "file:///C:/outside.json", "https://example.com/x", "http://localhost:4322/x" })
    if (Boundary.Resource(origin, unsafeUrl)) throw new Exception("External or malformed resource accepted");
Console.WriteLine("Private local Blob/resource boundary checks passed.");
