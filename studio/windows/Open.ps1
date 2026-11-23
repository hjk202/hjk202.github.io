param([string]$NodePath, [switch]$NoDialog)
$launchWatch = [Diagnostics.Stopwatch]::StartNew()
. "$PSScriptRoot\Launcher.ps1"
exit (Invoke-StudioLauncher -Action open -NodePath $NodePath -NoDialog:$NoDialog -LaunchWatch $launchWatch)
