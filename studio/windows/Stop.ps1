$ErrorActionPreference = 'Stop'
try {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node --experimental-strip-types "$PSScriptRoot\desktop.ts" stop
    if ($LASTEXITCODE -ne 0) { throw 'DESKTOP_STOP_FAILED' }
} catch {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Studio was not stopped. If you started it in a terminal, use Ctrl+C in that terminal. Save your article buffers first.', 'Personal Space Studio')
    exit 1
}
