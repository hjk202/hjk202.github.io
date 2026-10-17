Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# A PowerShell 7 parent can pass its module path to Windows PowerShell 5.1.
# Load the current host's built-in modules explicitly; never change machine/user policy.
foreach ($module in @('Microsoft.PowerShell.Security', 'Microsoft.PowerShell.Utility', 'Microsoft.PowerShell.Management')) {
    Import-Module ([IO.Path]::Combine($PSHOME, 'Modules', $module, ($module + '.psd1'))) -ErrorAction Stop
}

function Get-StudioStorePath {
    if (-not $env:LOCALAPPDATA) { throw 'LOCAL_CONFIG_UNAVAILABLE' }
    return [IO.Path]::Combine($env:LOCALAPPDATA, 'PersonalSpaceStudio', 'bailian.json')
}

function Assert-StudioStorePath([string]$Path) {
    $parent = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    foreach ($item in @($parent, $Path)) {
        if ((Test-Path -LiteralPath $item) -and ((Get-Item -LiteralPath $item -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'LOCAL_CONFIG_UNSAFE'
        }
    }
}

function Assert-StudioAiValues([string]$BaseUrl, [Security.SecureString]$Secret) {
    if ($Secret.Length -lt 1 -or $Secret.Length -gt 512) { throw 'LOCAL_CONFIG_INVALID' }
    if ($BaseUrl -cne $BaseUrl.Trim() -or $BaseUrl -notmatch '^https://[a-z0-9][a-z0-9-]{0,62}\.(cn-beijing|us-east-1|ap-southeast-1|eu-central-1|ap-northeast-1)\.maas\.aliyuncs\.com/compatible-mode/v1/?$') {
        throw 'LOCAL_CONFIG_INVALID'
    }
    $plain = [Net.NetworkCredential]::new('', $Secret).Password
    try { if ($plain -notmatch '^[\x21-\x7e]{1,512}$') { throw 'LOCAL_CONFIG_INVALID' } }
    finally { $plain = $null }
}

function Save-StudioCredential([string]$Path, [string]$BaseUrl, [Security.SecureString]$Secret) {
    Assert-StudioStorePath $Path
    Assert-StudioAiValues $BaseUrl $Secret
    $parent = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    [void][IO.Directory]::CreateDirectory($parent)
    Assert-StudioStorePath $Path
    # No -Key: Windows DPAPI binds this ciphertext to the current account/machine.
    $protectedKey = ConvertFrom-SecureString -SecureString $Secret
    $json = @{ version = 1; baseUrl = $BaseUrl.TrimEnd('/'); protectedKey = $protectedKey } | ConvertTo-Json -Compress
    $temporary = [IO.Path]::Combine($parent, ([IO.Path]::GetRandomFileName() + '.tmp'))
    $stream = $null
    try {
        $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
        $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true); $stream.Dispose(); $stream = $null
        Assert-StudioStorePath $Path
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if ($stream) { $stream.Dispose() }
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Read-StudioCredential([string]$Path) {
    Assert-StudioStorePath $Path
    if (-not [IO.File]::Exists($Path)) { return $null }
    if ((Get-Item -LiteralPath $Path).Length -gt 65536) { throw 'LOCAL_CONFIG_INVALID' }
    $value = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $names = @($value.PSObject.Properties.Name | Sort-Object)
    if (($names -join ',') -ne 'baseUrl,protectedKey,version' -or $value.version -ne 1 -or
        $value.baseUrl -isnot [string] -or $value.protectedKey -isnot [string]) { throw 'LOCAL_CONFIG_INVALID' }
    $secret = $null
    try {
        $secret = ConvertTo-SecureString -String $value.protectedKey
        Assert-StudioAiValues $value.baseUrl $secret
        # Consumed only through a private child-process pipe by local.ts; never a terminal/log/API.
        return @{ baseUrl = $value.baseUrl; apiKey = [Net.NetworkCredential]::new('', $secret).Password }
    } finally { if ($secret) { $secret.Dispose() } }
}
