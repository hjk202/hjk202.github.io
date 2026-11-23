$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Import-Module ([IO.Path]::Combine($PSHOME, 'Modules', 'Microsoft.PowerShell.Utility', 'Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop

function Write-StudioLaunchTiming {
    param([Diagnostics.Stopwatch]$Watch, [string]$Outcome)
    if ($null -eq $Watch) { return }
    $temporary = $null
    try {
        $root = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..'))
        $directory = [IO.Path]::Combine($root, '.cache', 'studio')
        foreach ($part in @($root, [IO.Path]::Combine($root, '.cache'), $directory)) {
            if (-not [IO.Directory]::Exists($part) -or (([IO.File]::GetAttributes($part)) -band [IO.FileAttributes]::ReparsePoint)) { throw 'UNSAFE_TIMING_DIRECTORY' }
        }
        $target = [IO.Path]::Combine($directory, 'startup-launcher-latest.json')
        if ([IO.File]::Exists($target) -and (([IO.File]::GetAttributes($target)) -band [IO.FileAttributes]::ReparsePoint)) { throw 'UNSAFE_TIMING_FILE' }
        $text = '{"version":1,"clock":"launcher-stopwatch-ms","outcome":"' + $Outcome + '","elapsedMs":' + $Watch.ElapsedMilliseconds.ToString([Globalization.CultureInfo]::InvariantCulture) + '}'
        $temporary = $target + '.' + [Guid]::NewGuid().ToString('D') + '.tmp'
        $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $data = [Text.UTF8Encoding]::new($false).GetBytes($text); $stream.Write($data,0,$data.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        if ([IO.File]::Exists($target)) { [IO.File]::Replace($temporary,$target,[NullString]::Value) } else { [IO.File]::Move($temporary,$target) }
        $temporary = $null
    } catch { [Console]::Error.WriteLine('Studio: STARTUP_DIAGNOSTICS_UNAVAILABLE') }
    # Failed reports are preserved; never recursively clean or follow an uncertain path.
}
function Invoke-StudioLauncher {
    param([ValidateSet('open','stop')][string]$Action, [string]$NodePath, [switch]$NoDialog, [Diagnostics.Stopwatch]$LaunchWatch)
    $code = 'DESKTOP_FAILED'
    $messages = @{
        NODE_NOT_FOUND = 'Node.js was not found. Install the project Node version, then rebuild these shortcuts.'
        NODE_VERSION_UNSUPPORTED = 'This Node version cannot run Studio. Use the version in .node-version.'
        DEPENDENCIES_MISSING = 'Project dependencies or launch files are missing. In the repository run npm.cmd ci, then try again.'
        WEB_BUILD_FAILED = 'The editor build failed. Run npm.cmd run studio:build in the repository to inspect the build error.'
        WEB_SOURCE_CHANGED = 'Editor source changed during the build. Finish updating the files, then open Studio again.'
        PORT_UNAVAILABLE = 'Port 4322 is occupied. Stop the known conflicting service; Studio will not stop other programs.'
        USE_TERMINAL_CTRL_C = 'Studio was started in a terminal. Use that instance and stop it with Ctrl+C in its original terminal.'
        AUTHORING_BUSY = 'The authoring folder is in use. Stop the known Studio instance before trying again. Do not delete a live lock.'
        DESKTOP_BUSY = 'Another Studio instance is running or starting. Wait for it, or stop it through its own entry.'
        DESKTOP_STATE_INVALID = 'Studio state is invalid or linked. Preserve it and follow the M7 recovery instructions in MAINTENANCE.md. Do not clear the cache.'
        DESKTOP_STATE_CHANGED = 'Studio state changed during the operation. Nothing else was removed. Preserve the state and retry after checking the running instance.'
        DESKTOP_RECOVERY_REQUIRED = 'State ownership cannot be proved. Follow the M7 recovery instructions in MAINTENANCE.md; do not delete unknown locks.'
        DESKTOP_UNAVAILABLE = 'The control pipe is unavailable. Retry once; if it persists, use the M7 recovery instructions in MAINTENANCE.md.'
        DESKTOP_START_TIMEOUT = 'Startup did not finish in time. The process was not force-stopped. Try opening again to check the same instance.'
        DESKTOP_STOP_TIMEOUT = 'Shutdown did not finish in time. Save your buffers and inspect the instance before trying again.'
        DESKTOP_STOP_FAILED = 'Studio could not confirm a safe shutdown. The process was not force-stopped.'
        LOCAL_CONFIG_INVALID = 'The local encrypted AI configuration could not be read. Preserve it; use studio:configure only if you intend to replace the configuration.'
        LOCAL_CONFIG_UNSAFE = 'The local AI configuration is linked or unsafe. Preserve it and check the configuration location.'
        DOTNET_SDK_MISSING = 'The .NET SDK required by studio/desktop/global.json is missing. Install that SDK and rebuild Studio.'
        NUGET_SOURCE_UNAVAILABLE = 'Studio could not reach the NuGet package source or its vulnerability data. Restore access to api.nuget.org, then reopen Studio.'
        APP_BUILD_FAILED = 'The Windows host build failed. Follow MAINTENANCE.md to restore and build the locked desktop project.'
        APP_SOURCE_CHANGED = 'Windows host source changed during the build. Finish the update and open Studio again.'
        APP_MODE_CONFLICT = 'An older browser-mode Studio is running. Save its buffers, stop it through its own entry, then reopen the App.'
        WEBVIEW2_RUNTIME_MISSING = 'Microsoft Edge WebView2 Runtime is missing. Install the Evergreen Runtime from Microsoft, then open Studio again.'
        APP_START_FAILED = 'The Windows App could not start. Check the .NET Desktop Runtime and WebView2 Runtime requirements in MAINTENANCE.md.'
        APP_START_TIMEOUT = 'The Windows App did not become ready. Preserve the current instance and check its window before trying again.'
        APP_EXITED = 'The App window exited before startup completed. Open it again after checking the runtime requirements.'
        PREPARATION_REQUIRED = 'Studio is not prepared. Save and close Studio, run npm.cmd run studio:prepare in the repository, then use the same icon.'
        PREPARED_INVALID = 'Prepared files, dependency identity or runtime version do not match. Preserve the files, close Studio, then run npm.cmd run studio:prepare. Do not clear credentials.'
        PREPARATION_FAILED = 'Studio preparation failed. The previous complete version and credentials are preserved. Check the fixed build error before preparing again.'
    }
    try {
        if (-not $NodePath -or -not [IO.File]::Exists($NodePath)) {
            $command = Get-Command node.exe -ErrorAction SilentlyContinue
            if (-not $command) { $code = 'NODE_NOT_FOUND'; throw $code }
            $NodePath = $command.Source
        }
        $entryName = 'desktop.ts'
        if ($Action -eq 'open') { $entryName = 'run.ts' }
        $entry = [IO.Path]::Combine($PSScriptRoot, $entryName)
        if (-not [IO.File]::Exists($entry)) { $code = 'DEPENDENCIES_MISSING'; throw $code }
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = $NodePath
        $info.Arguments = '--experimental-strip-types "' + $entry + '" ' + $Action
        $info.WorkingDirectory = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..'))
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        if ($Action -eq 'open') {
            # Explorer may still have an older copy of the user's environment.
            foreach ($name in @('HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY')) {
                if (-not $info.EnvironmentVariables[$name]) {
                    $configured = [Environment]::GetEnvironmentVariable($name, 'User')
                    if ($configured) { $info.EnvironmentVariables[$name] = $configured }
                }
            }
            if (-not (Get-Command gh.exe -CommandType Application -ErrorAction SilentlyContinue)) {
                $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                if ($userPath) { $info.EnvironmentVariables['Path'] += ';' + [Environment]::ExpandEnvironmentVariables($userPath) }
            }
        }
        $child = New-Object System.Diagnostics.Process
        $child.StartInfo = $info
        try {
            $null = $child.Start()
            $stdout = $child.StandardOutput.ReadToEndAsync()
            $stderr = $child.StandardError.ReadToEndAsync()
            $child.WaitForExit()
            $null = $stdout.GetAwaiter().GetResult()
            $errorText = $stderr.GetAwaiter().GetResult()
            if ($child.ExitCode -ne 0) {
                if ($errorText -match 'Studio: ([A-Z_]+)') { $code = $Matches[1] }
                elseif ($errorText -match 'ERR_MODULE_NOT_FOUND') { $code = 'DEPENDENCIES_MISSING' }
                elseif ($errorText -match 'bad option.*experimental-strip-types') { $code = 'NODE_VERSION_UNSUPPORTED' }
                throw $code
            }
        } finally { $child.Dispose() }
        Write-StudioLaunchTiming -Watch $LaunchWatch -Outcome 'ready'
        return 0
    } catch {
        $message = $messages[$code]
        if (-not $message) { $message = 'Studio could not finish the operation. Preserve the state and check MAINTENANCE.md.' }
        [Console]::Error.WriteLine('Studio: ' + $code)
        Write-StudioLaunchTiming -Watch $LaunchWatch -Outcome 'failed'
        if (-not $NoDialog) {
            Add-Type -AssemblyName PresentationFramework
            $null = [Windows.MessageBox]::Show($code + "`n`n" + $message, 'Personal Space Studio')
        }
        return 1
    }
}
