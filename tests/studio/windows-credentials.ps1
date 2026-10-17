param([Parameter(Mandatory = $true)][string]$StorePath, [string]$Action = 'create')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\studio\windows\Credentials.ps1"
$secret = ConvertTo-SecureString 'NON_SENSITIVE_V0_KEY_CANARY' -AsPlainText -Force
try {
    if ($Action -eq 'update') {
        $secret.Dispose(); $secret = ConvertTo-SecureString 'NON_SENSITIVE_V0_UPDATED_KEY' -AsPlainText -Force
    }
    $base = 'https://fixture.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
    if ($Action -eq 'invalid') { $base = 'https://evil.example/compatible-mode/v1' }
    Save-StudioCredential $StorePath $base $secret
    [Console]::Out.Write('saved')
} catch {
    [Console]::Error.Write('FIXTURE_SAVE_REJECTED'); exit 1
} finally { $secret.Dispose() }
