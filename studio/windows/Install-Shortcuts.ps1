param([string]$DesktopPath = [Environment]::GetFolderPath('DesktopDirectory'))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$shell = New-Object -ComObject WScript.Shell
$repository = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..'))
foreach ($entry in @(@('Personal Space Studio', 'Open.ps1'), @('Stop Personal Space Studio', 'Stop.ps1'))) {
    $target = [IO.Path]::Combine($DesktopPath, $entry[0] + '.lnk')
    if (Test-Path -LiteralPath $target) {
        $existing = $shell.CreateShortcut($target)
        if ($existing.Description -ne 'Personal Space Studio local launcher') { throw 'SHORTCUT_ALREADY_EXISTS' }
    }
    $link = $shell.CreateShortcut($target)
    $link.TargetPath = [IO.Path]::Combine($env:SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    $link.Arguments = '-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "' + [IO.Path]::Combine($PSScriptRoot, $entry[1]) + '"'
    $link.WorkingDirectory = $repository
    $link.Description = 'Personal Space Studio local launcher'
    $link.IconLocation = [IO.Path]::Combine($env:SystemRoot, 'System32', 'shell32.dll') + ',70'
    $link.Save()
}
Write-Host 'Studio open/stop shortcuts installed.'
