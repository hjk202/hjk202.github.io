[CmdletBinding(DefaultParameterSetName = 'Read')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Read')][string]$StorePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Resolve')][switch]$ResolveStorePath
)
$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\Credentials.ps1"
    if ($ResolveStorePath) { [Console]::Out.Write(((Get-StudioStorePath) | ConvertTo-Json -Compress)); exit 0 }
    $value = Read-StudioCredential $StorePath
    if ($null -eq $value) { [Console]::Out.Write('null') }
    else { [Console]::Out.Write(($value | ConvertTo-Json -Compress)) }
} catch {
    [Console]::Error.Write('LOCAL_CONFIG_INVALID')
    exit 1
}
