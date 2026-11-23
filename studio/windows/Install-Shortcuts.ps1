param([string]$DesktopPath = [Environment]::GetFolderPath('DesktopDirectory'))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$shell = New-Object -ComObject WScript.Shell
$repository = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..'))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$icon = [IO.Path]::Combine($repository, 'studio', 'desktop', 'assets', 'studio-blue-hair.ico')
if (-not [IO.File]::Exists($icon)) { throw 'STUDIO_ICON_MISSING' }
$entries = ,@('Personal Space Studio', 'Open.ps1')
if (-not [IO.Directory]::Exists($DesktopPath)) { throw 'DESKTOP_DIRECTORY_MISSING' }
# Preflight the launcher and legacy stop link before writing or removing anything.
function Assert-StudioShortcut([string]$target, [string]$scriptName) {
    if (-not (Test-Path -LiteralPath $target)) { return }
    $existing = $shell.CreateShortcut($target)
    $item = Get-Item -LiteralPath $target -Force
    $expectedTarget = [IO.Path]::Combine($env:SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    $expectedScript = [Regex]::Escape([IO.Path]::Combine($PSScriptRoot, $scriptName))
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.LinkType -or
        $existing.Description -ne 'Personal Space Studio local launcher' -or $existing.WorkingDirectory -ne $repository -or
        $existing.TargetPath -ne $expectedTarget -or $existing.Arguments -notmatch ('^-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "' + $expectedScript + '" -NodePath "[^"\r\n]+"$')) { throw 'SHORTCUT_ALREADY_EXISTS' }
}
foreach ($entry in @(@('Personal Space Studio', 'Open.ps1'), @('Stop Personal Space Studio', 'Stop.ps1'))) {
    $target = [IO.Path]::Combine($DesktopPath, $entry[0] + '.lnk')
    Assert-StudioShortcut $target $entry[1]
}
$legacy = [IO.Path]::Combine($DesktopPath, 'Stop Personal Space Studio.lnk')
$legacyBytes = if ([IO.File]::Exists($legacy)) { [Convert]::ToBase64String([IO.File]::ReadAllBytes($legacy)) } else { $null }
foreach ($entry in $entries) {
    $target = [IO.Path]::Combine($DesktopPath, $entry[0] + '.lnk')
    $link = $shell.CreateShortcut($target)
    $link.TargetPath = [IO.Path]::Combine($env:SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    $link.Arguments = '-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "' + [IO.Path]::Combine($PSScriptRoot, $entry[1]) + '" -NodePath "' + $node + '"'
    $link.WorkingDirectory = $repository
    $link.Description = 'Personal Space Studio local launcher'
    $link.WindowStyle = 7
    $link.IconLocation = $icon + ',0'
    $link.Save()
}
if ($null -ne $legacyBytes) {
    Assert-StudioShortcut $legacy 'Stop.ps1'
    if (-not [IO.File]::Exists($legacy) -or [Convert]::ToBase64String([IO.File]::ReadAllBytes($legacy)) -cne $legacyBytes) { throw 'SHORTCUT_CHANGED' }
    Remove-Item -LiteralPath $legacy -ErrorAction Stop
}
Write-Host 'Studio launch shortcut installed. Close the App window to stop its backend.'
