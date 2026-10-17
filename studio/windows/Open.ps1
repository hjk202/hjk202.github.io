$ErrorActionPreference = 'Stop'
try {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node --experimental-strip-types "$PSScriptRoot\desktop.ts" open
    if ($LASTEXITCODE -ne 0) { throw 'DESKTOP_START_FAILED' }
    Start-Process -FilePath 'http://127.0.0.1:4322/'
} catch {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Studio could not start. Check .cache/studio/desktop-error.json. Stop any older terminal instance with Ctrl+C; do not remove a lock while it is running.', 'Personal Space Studio')
    exit 1
}
