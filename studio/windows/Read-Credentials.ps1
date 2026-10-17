param([Parameter(Mandatory = $true)][string]$StorePath)
$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\Credentials.ps1"
    $value = Read-StudioCredential $StorePath
    if ($null -eq $value) { [Console]::Out.Write('null') }
    else { [Console]::Out.Write(($value | ConvertTo-Json -Compress)) }
} catch {
    [Console]::Error.Write('LOCAL_CONFIG_INVALID')
    exit 1
}
