param([string]$BaseUrl = '')
$ErrorActionPreference = 'Stop'
$secret = $null
try {
    . "$PSScriptRoot\Credentials.ps1"
    if (-not $BaseUrl) { $BaseUrl = Read-Host 'Bailian OpenAI-compatible Base URL' }
    $secret = Read-Host 'Bailian API Key (hidden; remember for this Windows account)' -AsSecureString
    Save-StudioCredential (Get-StudioStorePath) $BaseUrl $secret
    Write-Host 'Saved with Windows DPAPI. The key is not stored in the repository.'
} catch {
    Write-Host 'Configuration was not saved. Check the Base URL/key and try again.'
    exit 1
} finally { if ($secret) { $secret.Dispose() } }
