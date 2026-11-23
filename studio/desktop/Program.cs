using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PersonalSpaceStudio;

internal static class Program
{
    internal static void Send(object value)
    {
        try { Console.WriteLine(JsonSerializer.Serialize(value)); Console.Out.Flush(); }
        catch (IOException) { /* A lost parent pipe grants no new capability; ReadControl handles EOF. */ }
    }
    [STAThread]
    static void Main()
    {
        // WinExe has redirected standard handles, but deliberately has no console/code page.
        Console.SetIn(new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)));
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
        ApplicationConfiguration.Initialize();
        try
        {
            var line = Console.ReadLine();
            if (line == null || line.Length > 512) throw new InvalidOperationException();
            using var json = JsonDocument.Parse(line); var value = json.RootElement;
            if (Boundary.Boot(value)) { Application.Run(new StudioWindow(null,Boundary.Text(value,"version"))); return; }
            var origin = Boundary.Text(value, "origin");
            if (!Boundary.Fields(value, "type", "origin") || Boundary.Text(value, "type") != "studio:init"
                || origin == null || !Boundary.Root(origin + "/") || origin.EndsWith('/')) throw new InvalidOperationException();
            Application.Run(new StudioWindow(origin));
        }
        catch { Send(new { type = "studio:app-error", code = "APP_START_FAILED" }); Environment.ExitCode = 1; }
    }
}

internal sealed class StudioWindow : Form
{
    readonly WebView2 view = new() { Dock = DockStyle.Fill };
    readonly Label status = new() { Dock = DockStyle.Top, Height = 28, Text = "正在打开 Studio…", AutoSize = false };
    string origin;
    readonly TaskCompletionSource originReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    bool allowClose, editorReady, editorConnected,disconnected, selectingPrivate;
    string? closeId, preparedId;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);

    internal StudioWindow(string? initialOrigin, string? version = null)
    {
        origin = initialOrigin ?? ""; if(initialOrigin != null) originReady.SetResult();
        Text = "Personal Space Studio" + (version == null ? "" : " · " + version[..12]); Width = 1280; Height = 940;
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        MinimumSize = new Size(980, 650); StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(view); Controls.Add(status);
        FormClosing += (_, e) => {
            if (allowClose) return;
            e.Cancel = true;
            if (!disconnected) Program.Send(new { type = "studio:request-close" });
            else if (closeId == null) {
                using var json = JsonDocument.Parse(JsonSerializer.Serialize(new { type = "studio:prepare-close", requestId = Guid.NewGuid().ToString("D") }));
                ControlMessage(json.RootElement);
            }
        };
        Shown += async (_, _) => { Program.Send(new { type = "studio:window-visible" }); _ = Task.Run(ReadControl); await Initialize(); };
    }
    async Task Initialize()
    {
        try
        {
            status.Text = "正在初始化 WebView2…"; Program.Send(new { type = "studio:webview-start" });
            _ = CoreWebView2Environment.GetAvailableBrowserVersionString();
            view.CreationProperties = new CoreWebView2CreationProperties {
                UserDataFolder = Path.Combine(AppContext.BaseDirectory, "profile"), IsInPrivateModeEnabled = true
            };
            await view.EnsureCoreWebView2Async();
            Program.Send(new { type = "studio:webview-ready" }); status.Text = "正在载入编辑器…";
            var core = view.CoreWebView2; var settings = core.Settings;
            settings.AreHostObjectsAllowed = false; settings.AreDevToolsEnabled = false;
            settings.AreDefaultContextMenusEnabled = false; settings.AreBrowserAcceleratorKeysEnabled = false;
            settings.IsPasswordAutosaveEnabled = false; settings.IsGeneralAutofillEnabled = false; settings.IsStatusBarEnabled = false;
            core.NavigationStarting += (_, e) => { if (!Boundary.SameRoot(origin, e.Uri)) e.Cancel = true; };
            core.FrameNavigationStarting += (_, e) => { if (e.Uri != "about:srcdoc" && e.Uri != "about:blank") e.Cancel = true; };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.DownloadStarting += (_, e) => e.Cancel = true;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) => {
                if (Boundary.Resource(origin, e.Request.Uri)) return;
                e.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(), 403, "Blocked", "Content-Type: text/plain");
            };
            core.WebMessageReceived += (_, e) => {
                if (!Boundary.SameRoot(origin, e.Source) || !Boundary.SameRoot(origin, core.Source)) return;
                var raw = e.WebMessageAsJson; if (raw.Length > 256) return;
                try {
                    using var json = JsonDocument.Parse(raw); var value = json.RootElement;
                    if (Boundary.PrivateSelection(value) && editorConnected && !disconnected && closeId == null && !selectingPrivate) {
                        selectingPrivate = true;
                        var id = Boundary.Text(value, "requestId");
                        try {
                            var mode = Boundary.Text(value, "mode")!;
                            var path = PrivateFilePicker.Select(this, mode);
                            if (path == null) core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "studio:private-cancelled", requestId = id }));
                            else Program.Send(new { type = "studio:private-selected-file", requestId = id, mode, path });
                        } catch { core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "studio:private-error", requestId = id, code = "PRIVATE_FILE_SELECTION_INVALID" })); }
                        finally { selectingPrivate = false; }
                        return;
                    }
                    if(Boundary.Fields(value,"type") && Boundary.Text(value,"type")=="studio:editor-initialized" && !editorConnected) {
                        editorConnected=true;Program.Send(new {type="studio:editor-connected"});
                    }
                    else if (Boundary.Fields(value, "type") && Boundary.Text(value, "type") == "studio:editor-ready" && !editorReady) {
                        editorReady = editorConnected = true; status.Visible = false;
                        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                        Activate(); _ = SetForegroundWindow(Handle); Program.Send(new { type = "studio:window-ready" });
                    }
                    else if (Boundary.Fields(value, "type", "requestId", "status") && Boundary.Text(value, "type") == "studio:close-result"
                        && closeId != null && Boundary.Text(value, "requestId") == closeId
                        && Boundary.Text(value, "status") is "ready" or "cancel") {
                        var result = Boundary.Text(value, "status"); preparedId = result == "ready" ? closeId : null; closeId = null;
                        if (disconnected) { if (result == "ready") { allowClose = true; Close(); } }
                        else Program.Send(new { type = "studio:close-result", requestId = Boundary.Text(value, "requestId"), status = result });
                    }
                } catch (JsonException) { /* Reject malformed messages without echoing their contents. */ }
            };
            core.ProcessFailed += (_, _) => {
                editorReady = editorConnected = false; status.Visible = true; status.Text = "编辑器进程异常，内存草稿可能已丢失。请关闭后重开；不会自动重试写入。";
                Program.Send(new { type = "studio:editor-failed" });
            };
            if(origin == "") status.Text = "正在启动本机 API，尚未就绪…";
            await originReady.Task.WaitAsync(TimeSpan.FromSeconds(25));
            if(!IsDisposed) { status.Text = "正在载入文章列表…"; core.Navigate(origin + "/"); }
        }
        catch (WebView2RuntimeNotFoundException) { Fail("WEBVIEW2_RUNTIME_MISSING"); }
        catch { if(!IsDisposed) Fail("APP_START_FAILED"); }
    }
    void Fail(string code) { Program.Send(new { type = "studio:app-error", code }); allowClose = true; Close(); }
    async Task ReadControl()
    {
        try {
            while (await Console.In.ReadLineAsync() is string line) {
                if (line.Length > 512) continue;
                BeginInvoke(() => {
                    try { using var json = JsonDocument.Parse(line); ControlMessage(json.RootElement); }
                    catch (JsonException) { /* Reject unknown transport input. */ }
                });
            }
        } catch (IOException) { /* Parent pipe lost: keep the buffer until an explicit close decision. */ }
        if (IsDisposed) return;
        BeginInvoke(() => {
            disconnected = true;
            status.Visible = true; status.Text = "本机服务连接已中断。请复制未保存内容；关闭窗口仍需确认，不会自动重试保存。";
            if (!editorConnected) { allowClose = true; Close(); }
        });
    }
    void ControlMessage(JsonElement value)
    {
        var type = Boundary.Text(value, "type");
        if(type == "studio:init" && origin == "" && Boundary.Fields(value,"type","origin")
            && Boundary.Text(value,"origin") is string initialized && Boundary.Root(initialized + "/") && !initialized.EndsWith('/')) {
            origin = initialized; originReady.TrySetResult(); return;
        }
        if (type == "studio:private-bound" && Boundary.Fields(value, "type", "requestId", "handle")
            && Boundary.Id(Boundary.Text(value, "requestId")) && Boundary.Id(Boundary.Text(value, "handle"))
            && editorConnected && Boundary.SameRoot(origin, view.CoreWebView2.Source)) {
            view.CoreWebView2.PostWebMessageAsJson(value.GetRawText()); return;
        }
        if (type == "studio:private-error" && Boundary.Fields(value, "type", "requestId", "code")
            && Boundary.Id(Boundary.Text(value, "requestId")) && Boundary.Text(value, "code") == "PRIVATE_FILE_SELECTION_INVALID"
            && editorConnected && Boundary.SameRoot(origin, view.CoreWebView2.Source)) {
            view.CoreWebView2.PostWebMessageAsJson(value.GetRawText()); return;
        }
        if (type == "studio:activate" && Boundary.Fields(value, "type")) {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate(); _ = SetForegroundWindow(Handle);
        }
        else if (type == "studio:prepare-close" && Boundary.Fields(value, "type", "requestId")
            && Boundary.Id(Boundary.Text(value, "requestId")) && closeId == null) {
            var id = Boundary.Text(value, "requestId");
            if (!editorConnected) {
                if (MessageBox.Show(this, "编辑器不可用，无法恢复内存草稿。退出 Studio？", "Personal Space Studio", MessageBoxButtons.OKCancel) == DialogResult.OK)
                    Program.Send(new { type = "studio:close-result", requestId = id, status = "ready" });
                else Program.Send(new { type = "studio:close-result", requestId = id, status = "cancel" });
                return;
            }
            if (!Boundary.SameRoot(origin, view.CoreWebView2.Source)) return;
            closeId = id; view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type, requestId = id }));
        }
        else if (type == "studio:close-complete" && Boundary.Fields(value, "type")) { allowClose = true; Close(); }
        else if (type == "studio:close-failed" && Boundary.Fields(value, "type", "requestId") && preparedId != null
            && Boundary.Text(value, "requestId") == preparedId && Boundary.SameRoot(origin, view.CoreWebView2.Source)) {
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type, requestId = preparedId })); preparedId = null;
        }
        else if (type == "studio:service-lost" && Boundary.Fields(value, "type")) {
            status.Visible = true; status.Text = "本机服务异常，缓冲仍保留。请复制内容后退出并重开；不会自动重试写入。";
        }
    }
}
