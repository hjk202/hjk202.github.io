param([string]$NodePath, [switch]$NoDialog)
. "$PSScriptRoot\Launcher.ps1"
exit (Invoke-StudioLauncher -Action stop -NodePath $NodePath -NoDialog:$NoDialog)
