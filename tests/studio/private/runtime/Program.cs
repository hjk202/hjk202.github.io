using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using PersonalSpaceStudio;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var config = JsonDocument.Parse(Console.ReadLine() ?? "null");
        var origin = config.RootElement.GetProperty("origin").GetString()!;
        var profile = config.RootElement.GetProperty("profile").GetString()!;
        var editor = config.RootElement.TryGetProperty("editorHandle", out var editorHandle);
        if (editor && !Boundary.Id(editorHandle.GetString())) throw new InvalidOperationException();
        var delivery = config.RootElement.TryGetProperty("exportHandle", out var exportHandle);
        if(delivery && (!editor || !Boundary.Id(exportHandle.GetString()))) throw new InvalidOperationException();
        if (!Boundary.Root(origin + "/")) throw new InvalidOperationException();
        using var form = new Form { ShowInTaskbar = false, Text = "Non-sensitive hidden memory probe" };
        var activated=false;var shown=false;form.Activated+=(_,_)=>activated=true;form.VisibleChanged+=(_,_)=>shown|=form.Visible;
        using var view = new WebView2(); form.Controls.Add(view); _ = form.Handle; _ = view.Handle;
        using var context = new ApplicationContext();
        form.BeginInvoke(new Action(async () => {
            CoreWebView2Environment? environment = null;
            var exited = new TaskCompletionSource<bool>();
            object result; var stage = "environment";
            try {
                environment = await CoreWebView2Environment.CreateAsync(null, profile, new CoreWebView2EnvironmentOptions { ExclusiveUserDataFolderAccess = true });
                environment.BrowserProcessExited += (_, _) => exited.TrySetResult(true);
                view.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = profile, IsInPrivateModeEnabled = true };
                stage = "ensure-core"; await view.EnsureCoreWebView2Async(environment);
                var core = view.CoreWebView2; var rootMessages = 0; var navigationBlocked = 0;
                var childFrame = new TaskCompletionSource<CoreWebView2Frame>();
                core.FrameCreated += (_, e) => childFrame.TrySetResult(e.Frame);
                core.Settings.AreHostObjectsAllowed = false; core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false; core.Settings.IsGeneralAutofillEnabled = false;
                core.NavigationStarting += (_, e) => { if (!Boundary.SameRoot(origin, e.Uri)) { navigationBlocked++; e.Cancel = true; } };
                core.FrameNavigationStarting += (_, e) => { if (e.Uri != "about:srcdoc" && e.Uri != "about:blank") e.Cancel = true; };
                core.NewWindowRequested += (_, e) => e.Handled = true;
                core.DownloadStarting += (_, e) => e.Cancel = true;
                core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
                core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                core.WebResourceRequested += (_, e) => {
                    if (!Boundary.Resource(origin, e.Request.Uri)) e.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(), 403, "Blocked", "Content-Type: text/plain");
                };
                core.WebMessageReceived += (_, e) => {
                    if (!Boundary.SameRoot(origin, e.Source) || !Boundary.SameRoot(origin, core.Source)) return;
                    using var message = JsonDocument.Parse(e.WebMessageAsJson);
                    if (Boundary.PrivateSelection(message.RootElement)) {
                        rootMessages++;
                        if (editor) core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "studio:private-bound", requestId = Boundary.Text(message.RootElement,"requestId"), handle = Boundary.Text(message.RootElement,"mode")=="export"&&delivery?exportHandle.GetString():editorHandle.GetString() }));
                    }
                };
                var navigated = new TaskCompletionSource<bool>();
                core.NavigationCompleted += (_, e) => navigated.TrySetResult(e.IsSuccess);
                stage = "navigation"; core.Navigate(origin + "/");
                if (!await navigated.Task.WaitAsync(TimeSpan.FromSeconds(15))) throw new InvalidOperationException();
                for (var count = 0; count < 100 && await core.ExecuteScriptAsync(editor ? "Boolean(document.querySelector('#private-editor'))" : "Boolean(globalThis.__privateProbe)") != "true"; count++) await Task.Delay(50);
                await core.ExecuteScriptAsync(delivery ? "globalThis.__deliveryProbe=true" : "globalThis.__deliveryProbe=false");
                stage = "memory-script"; await core.ExecuteScriptAsync(editor ? EditorScript.Value : """
globalThis.__probeResult = null;
let memoryStage=0; (async () => {
 const session = new globalThis.__privateProbe.PrivateSession();
 const marker = String.fromCharCode(83,84,85,68,73,79,95,77,49,50,95,86,79,76,65,84,73,76,69,95,67,65,78,65,82,89,95,55,50,57,49,51,55,95) + crypto.randomUUID();
 const password = marker + crypto.randomUUID();
 const reference = {revision:'3'.repeat(64),slugs:[]};
 memoryStage=1; session.create(reference); const candidate = session.snapshot();
 candidate.modules.think = {posts:[{id:'a'.repeat(32),title:marker,summary:'non-sensitive',date:'2026-10-23',kind:'article',body:marker}]};
 memoryStage=2; session.replaceCandidate(candidate);
 const input = document.createElement('textarea'); input.autocomplete = 'off'; input.value = marker; document.body.append(input);
 memoryStage=3; const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0)); const blob=URL.createObjectURL(new Blob([png,marker],{type:'image/png'})); const image=new Image(); const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject}); image.src=blob; document.body.append(image); await loaded; const echoed=image.naturalWidth===1; image.remove(); URL.revokeObjectURL(blob);
 memoryStage=4; const sealed = await session.seal(password,reference); session.lock(); input.value=''; input.remove();
 memoryStage=5; await session.unlock(sealed.envelope,password,reference); const recovered = session.snapshot().modules.think.posts[0].body === marker; session.lock();
 memoryStage=6; chrome.webview.postMessage({type:'studio:private-select',requestId:crypto.randomUUID(),mode:'open'});
 const frame = document.createElement('iframe'); frame.sandbox = 'allow-scripts'; frame.src = 'about:blank';
 document.body.append(frame); await new Promise(resolve=>setTimeout(resolve,150));
 globalThis.__probeResult = {ok:echoed&&recovered&&!session.unlocked,storesEmpty:localStorage.length===0&&sessionStorage.length===0};
})().catch(()=>{globalThis.__probeResult={ok:false,storesEmpty:false,memoryStage};});
""");
                JsonDocument? proof = null;
                for (var count = 0; count < 400; count++) {
                    var text = await core.ExecuteScriptAsync("globalThis.__probeResult");
                    if (text != "null") { proof = JsonDocument.Parse(text); break; }
                    await Task.Delay(50);
                }
                if(proof==null) stage="memory-timeout-"+ await core.ExecuteScriptAsync("memoryStage"); using (proof) { if (proof != null && proof.RootElement.TryGetProperty("memoryStage", out var failedStage)) stage = "memory-" + failedStage.GetInt32();
                    if (proof == null || !proof.RootElement.GetProperty("ok").GetBoolean() || !proof.RootElement.GetProperty("storesEmpty").GetBoolean()) throw new InvalidOperationException();
                }
                stage = "frame"; var frame = await childFrame.Task.WaitAsync(TimeSpan.FromSeconds(5));
                var frameAttempt = await frame.ExecuteScriptAsync("(()=>{try{memoryStage=6; chrome.webview.postMessage({type:'studio:private-select',requestId:'7e0bfeab-426a-4e45-943e-146fa87b1b8b',mode:'open'})}catch{};return true})()");
                if (frameAttempt != "true") throw new InvalidOperationException();
                await core.ExecuteScriptAsync("document.querySelector('iframe').remove()"); await Task.Delay(100);
                core.Navigate("https://example.invalid/blocked-probe"); await Task.Delay(100);
                stage = "final-boundaries"; if (rootMessages != (delivery?2:1) || navigationBlocked < 1 || !Boundary.SameRoot(origin, core.Source) || form.Visible || shown || activated || !core.Profile.IsInPrivateModeEnabled) throw new InvalidOperationException();
                result = new { ok = true, realWebView2 = true, privateMode = true, visibleWindow = shown, activatedWindow = activated, actualEditor=editor,actualDelivery=delivery,memoryCryptoAndLockPassed = true, blobImageTested = !editor, untrustedFrameRejected = true, externalNavigationBlocked = true, storesEmpty = true };
            } catch (Exception error) { result = new { ok = false, code = "RUNTIME_PROBE_FAILED", stage, exceptionType = error.GetType().Name, hresult = error.HResult, visibleWindow = shown,activatedWindow=activated }; Environment.ExitCode = 1; }
            view.Dispose(); form.Dispose();
            if (environment != null && await Task.WhenAny(exited.Task, Task.Delay(10000)) != exited.Task) { result = new { ok = false, code = "RUNTIME_EXIT_UNCONFIRMED", visibleWindow = false }; Environment.ExitCode = 1; }
            Console.WriteLine(JsonSerializer.Serialize(result)); context.ExitThread();
        }));
        Application.Run(context);
    }
}





