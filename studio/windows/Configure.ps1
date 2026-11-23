param([string]$BaseUrl = '', [ValidateSet('gemini','bailian')][string]$Provider = '')
$ErrorActionPreference = 'Stop'
$secret = $null
try {
    . "$PSScriptRoot\Credentials.ps1"
    if (-not $Provider) { if ($BaseUrl) { $Provider = 'bailian' } else { $Provider = Read-Host 'AI provider (gemini / bailian)' } }
    if ($Provider -notin @('gemini','bailian')) { throw 'LOCAL_CONFIG_INVALID' }
    $standard = Get-StudioStorePath
    $directory = [IO.Path]::GetDirectoryName($standard)
    $selected = [IO.Path]::Combine($directory,'gemini-selected')
    $path = $standard
    if ($Provider -eq 'gemini') { $path = [IO.Path]::Combine($directory,'gemini.json') }
    Assert-StudioStorePath $path
    Assert-StudioStorePath $selected
    $reuse = [IO.File]::Exists($path) -and -not $BaseUrl -and (Read-Host 'Use the existing encrypted key? [Y/n]') -notmatch '^[nN]'
    if (-not $reuse) {
        if ($Provider -eq 'gemini') { $BaseUrl = 'https://generativelanguage.googleapis.com/v1beta' }
        elseif (-not $BaseUrl) { $BaseUrl = Read-Host 'Bailian OpenAI-compatible Base URL' }
        $secret = Read-Host 'API Key (hidden; stored for this Windows account)' -AsSecureString
        Save-StudioCredential $path $BaseUrl $secret
    }
    if ($Provider -eq 'gemini' -and -not [IO.File]::Exists($selected)) {
        [IO.File]::Open($selected,[IO.FileMode]::CreateNew).Dispose()
    } elseif ($Provider -eq 'bailian' -and [IO.File]::Exists($selected)) {
        [IO.File]::Delete($selected)
    }
    Write-Host 'Saved with Windows DPAPI. The key is not stored in the repository.'
} catch {
    Write-Host 'Configuration was not saved. Check the Base URL/key and try again.'
    exit 1
} finally { if ($secret) { $secret.Dispose() } }
