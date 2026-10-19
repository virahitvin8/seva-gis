# ============================================================================
# SEVA.GIS - Claude Code provider switcher
# ----------------------------------------------------------------------------
# Switches Claude Code (~/.claude/settings.json) between:
#   shellshock  -> local free-model gateway (F:\SEVAGIS\seva gis\ShellShock)
#   radox       -> radoxai.com promo models (Claude Opus/GPT/Kimi)
#   deepseek    -> DeepSeek official Anthropic-compatible endpoint
#   zai         -> Z.AI GLM coding plan
#   kimi        -> Moonshot Kimi (standard API keys)
#   anthropic   -> stock official Anthropic behaviour
#
# Keys are NEVER stored in this script or in profiles.json. They come from
# (in priority order): -Key parameter, the provider's environment variable,
# scripts/claude-code/keys.local.json (git-ignored), or an interactive prompt.
#
# Usage:
#   .\switch-claude-code.ps1 -List
#   .\switch-claude-code.ps1 -Show
#   .\switch-claude-code.ps1 -Provider shellshock
#   .\switch-claude-code.ps1 -Provider radox -Key sk-... -SaveKey
#   .\switch-claude-code.ps1 -Provider deepseek -Model deepseek-chat
#   .\switch-claude-code.ps1 -Provider custom -BaseUrl http://localhost:20128/v1 -Key sk-...
# ============================================================================
[CmdletBinding()]
param(
  [string]$Provider = "",
  [string]$Key = "",
  [string]$BaseUrl = "",
  [string]$Model = "",
  [switch]$SaveKey,
  [switch]$Show,
  [switch]$List,
  [switch]$NoBackup,
  [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'

$ScriptDir    = $PSScriptRoot
$ProfilesPath = Join-Path $ScriptDir 'profiles.json'
$KeysPath     = Join-Path $ScriptDir 'keys.local.json'
$SettingsDir  = Join-Path $env:USERPROFILE '.claude'
$SettingsPath = Join-Path $SettingsDir 'settings.json'

# Every env key this switcher owns; cleared when switching to a profile that
# does not define it, so providers can never leak into each other.
$ManagedKeys = @(
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_CODE_EFFORT_LEVEL',
  'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'API_TIMEOUT_MS'
)

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) }
  catch { throw "Could not parse JSON at $Path : $($_.Exception.Message)" }
}

function Write-JsonFile([string]$Path, $Object, [int]$Depth) {
  # UTF-8 WITHOUT BOM: Claude Code (Node) fails to JSON.parse a leading BOM.
  $json = $Object | ConvertTo-Json -Depth $Depth
  [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Set-JsonProp($Object, [string]$Name, $Value) {
  $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Remove-JsonProp($Object, [string]$Name) {
  if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) {
    $Object.PSObject.Properties.Remove($Name)
  }
}

function Mask-Secret([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return '(none)' }
  if ($Value.Length -le 10) { return '****' }
  return $Value.Substring(0, 6) + '...' + $Value.Substring($Value.Length - 4)
}

function Invoke-Backup([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = "$Path.bak-$stamp"
  Copy-Item -LiteralPath $Path -Destination $backup -Force
  Write-Host "  Backup written: $backup" -ForegroundColor DarkGray
  # Keep only the 10 newest backups
  Get-ChildItem -Path (Split-Path $Path) -Filter ((Split-Path $Path -Leaf) + '.bak-*') |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 |
    Remove-Item -Force -ErrorAction SilentlyContinue
}

function Resolve-Key([string]$ProviderId, $ProfileDef, [string]$ProvidedKey) {
  if (-not [string]::IsNullOrWhiteSpace($ProvidedKey)) { return $ProvidedKey.Trim() }

  $envName = $null
  if ($null -ne $ProfileDef -and $null -ne $ProfileDef.PSObject.Properties['keyEnv']) {
    $envName = [string]$ProfileDef.keyEnv
  }
  if ($envName) {
    $fromEnv = [Environment]::GetEnvironmentVariable($envName, 'User')
    if (-not $fromEnv) { $fromEnv = [Environment]::GetEnvironmentVariable($envName, 'Process') }
    if (-not $fromEnv) { $fromEnv = [Environment]::GetEnvironmentVariable($envName, 'Machine') }
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) { return $fromEnv.Trim() }
  }

  $keysFile = Read-JsonFile $KeysPath
  if ($null -ne $keysFile -and $null -ne $keysFile.PSObject.Properties[$ProviderId]) {
    $stored = [string]$keysFile.PSObject.Properties[$ProviderId].Value
    if (-not [string]::IsNullOrWhiteSpace($stored)) { return $stored.Trim() }
  }
  return ''
}

function Save-Key([string]$ProviderId, [string]$Value) {
  $keysFile = Read-JsonFile $KeysPath
  if ($null -eq $keysFile) { $keysFile = New-Object PSCustomObject }
  Set-JsonProp $keysFile $ProviderId $Value
  $dir = Split-Path $KeysPath
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Write-JsonFile $KeysPath $keysFile 20
  Write-Host "  Key saved to $KeysPath (git-ignored)." -ForegroundColor DarkGray
}

function Test-Endpoint([string]$Url, [string]$Token) {
  # Non-fatal reachability check. Some Anthropic-style servers do not serve
  # /models, so a 404 still proves the host answered.
  try {
    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($Token)) { $headers['Authorization'] = "Bearer $Token" }
    $probe = $Url.TrimEnd('/') + '/models'
    $resp = Invoke-WebRequest -Uri $probe -Headers $headers -TimeoutSec 6 -UseBasicParsing
    Write-Host "  Endpoint check: reachable (HTTP $($resp.StatusCode))" -ForegroundColor Green
  } catch {
    $status = $null
    if ($_.Exception.Response) { try { $status = [int]$_.Exception.Response.StatusCode } catch { } }
    if ($status) {
      Write-Host "  Endpoint check: host answered (HTTP $status; /models listing may be unsupported - that is OK)" -ForegroundColor Yellow
    } else {
      Write-Host "  Endpoint check: NOT reachable from here ($($_.Exception.Message))" -ForegroundColor Yellow
    }
  }
}

# ---------------------------------------------------------------------------
# -List
# ---------------------------------------------------------------------------
if ($List) {
  $profiles = Read-JsonFile $ProfilesPath
  if ($null -eq $profiles) { throw "profiles.json not found next to this script." }
  Write-Host "" -NoNewline
  Write-Host "Claude Code provider profiles" -ForegroundColor Cyan
  Write-Host "=============================" -ForegroundColor Cyan
  foreach ($p in $profiles.profiles.PSObject.Properties) {
    $def  = $p.Value
    $url  = if ([string]::IsNullOrWhiteSpace([string]$def.baseUrl)) { '(official default)' } else { [string]$def.baseUrl }
    Write-Host ("  {0,-12} {1}" -f $p.Name, [string]$def.label)
    Write-Host ("  {0,-12} {1}" -f '', $url) -ForegroundColor DarkGray
  }
  Write-Host ""
  Write-Host "Apply with: .\switch-claude-code.ps1 -Provider <name>" -ForegroundColor Cyan
  return
}

# ---------------------------------------------------------------------------
# -Show (default when no provider given)
# ---------------------------------------------------------------------------
$currentSettings = Read-JsonFile $SettingsPath

if ($Show -or [string]::IsNullOrWhiteSpace($Provider)) {
  Write-Host ""
  Write-Host "Current Claude Code settings" -ForegroundColor Cyan
  Write-Host "============================" -ForegroundColor Cyan
  Write-Host ("  File: {0}" -f $SettingsPath)
  if ($null -eq $currentSettings) {
    Write-Host "  (no settings.json found yet)" -ForegroundColor Yellow
  } else {
    $envObj = $null
    if ($null -ne $currentSettings.PSObject.Properties['env']) { $envObj = $currentSettings.env }
    if ($null -eq $envObj) {
      Write-Host "  env: (none)" -ForegroundColor DarkGray
    } else {
      Write-Host ("  ANTHROPIC_BASE_URL : {0}" -f ([string]$envObj.ANTHROPIC_BASE_URL -as [string]))
      Write-Host ("  ANTHROPIC_AUTH_TOKEN: {0}" -f (Mask-Secret ([string]$envObj.ANTHROPIC_AUTH_TOKEN)))
      foreach ($mk in @('ANTHROPIC_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL')) {
        if ($null -ne $envObj.PSObject.Properties[$mk]) { Write-Host ("  {0,-19}: {1}" -f $mk, [string]$envObj.PSObject.Properties[$mk].Value) }
      }
    }
    if ($null -ne $currentSettings.PSObject.Properties['model']) {
      Write-Host ("  model              : {0}" -f [string]$currentSettings.model)
    }
  }
  Write-Host ""
  Write-Host "Use -List to see profiles, -Provider <name> to switch." -ForegroundColor DarkGray
  return
}

# ---------------------------------------------------------------------------
# Apply a profile
# ---------------------------------------------------------------------------
$profiles = Read-JsonFile $ProfilesPath
if ($null -eq $profiles) { throw "profiles.json not found next to this script." }

$profileNames = @($profiles.profiles.PSObject.Properties | ForEach-Object { $_.Name })
$isCustom = ($Provider -ieq 'custom')

if (-not $isCustom -and ($profileNames -notcontains $Provider)) {
  throw "Unknown provider '$Provider'. Run with -List to see the available profiles, or use -Provider custom -BaseUrl <url>."
}

$def  = if ($isCustom) { $null } else { $profiles.profiles.PSObject.Properties[$Provider].Value }
$label = if ($isCustom) { 'Custom endpoint' } else { [string]$def.label }

Write-Host ""
Write-Host "Switching Claude Code to: $Provider ($label)" -ForegroundColor Cyan

# Resolve effective base URL and key
$effBaseUrl = $BaseUrl
if ([string]::IsNullOrWhiteSpace($effBaseUrl) -and $null -ne $def -and $null -ne $def.PSObject.Properties['baseUrl']) {
  $effBaseUrl = [string]$def.baseUrl
}
if ($isCustom -and [string]::IsNullOrWhiteSpace($effBaseUrl)) {
  throw "Custom profile requires -BaseUrl (for example http://localhost:20128/v1)."
}

$needsKey = -not [string]::IsNullOrWhiteSpace($effBaseUrl)
$effKey   = Resolve-Key $Provider $def $Key

if ($needsKey -and [string]::IsNullOrWhiteSpace($effKey)) {
  Write-Host "  No key found for this provider (checked -Key, environment, keys.local.json)." -ForegroundColor Yellow
  $entered = Read-Host "  Paste the API key now (Enter to cancel)"
  if ([string]::IsNullOrWhiteSpace($entered)) {
    throw "Aborted - no key. Create one, then re-run with -Key <key> or set the provider's env var."
  }
  $effKey = $entered.Trim()
  $SaveKey = $true
}
if ($SaveKey -and -not [string]::IsNullOrWhiteSpace($effKey)) { Save-Key $Provider $effKey }

# Load and transform settings
$settings = $currentSettings
if ($null -eq $settings) { $settings = New-Object PSCustomObject }
if ($null -eq $settings.PSObject.Properties['env'] -or $null -eq $settings.env) {
  Set-JsonProp $settings 'env' (New-Object PSCustomObject)
}
$envObj = $settings.env

# Clear every managed key first (prevents provider leakage)
foreach ($mk in $ManagedKeys) { Remove-JsonProp $envObj $mk }

if ($Provider -ieq 'anthropic') {
  Write-Host "  Cleared all provider overrides - Claude Code is back to stock Anthropic." -ForegroundColor Green
} else {
  Set-JsonProp $envObj 'ANTHROPIC_BASE_URL' $effBaseUrl
  if (-not [string]::IsNullOrWhiteSpace($effKey)) { Set-JsonProp $envObj 'ANTHROPIC_AUTH_TOKEN' $effKey }

  if ($null -ne $def -and $null -ne $def.PSObject.Properties['settings'] -and $null -ne $def.settings) {
    foreach ($s in $def.settings.PSObject.Properties) { Set-JsonProp $envObj $s.Name ([string]$s.Value) }
  }

  if (-not [string]::IsNullOrWhiteSpace($Model)) {
    Set-JsonProp $envObj 'ANTHROPIC_MODEL' $Model
    Set-JsonProp $envObj 'ANTHROPIC_DEFAULT_OPUS_MODEL' $Model
    Set-JsonProp $envObj 'ANTHROPIC_DEFAULT_SONNET_MODEL' $Model
    Set-JsonProp $envObj 'ANTHROPIC_DEFAULT_HAIKU_MODEL' $Model
    Write-Host "  Model override applied to all slots: $Model" -ForegroundColor Green
  }

  Write-Host ("  Base URL : {0}" -f $effBaseUrl)
  Write-Host ("  Token    : {0}" -f (Mask-Secret $effKey))
}

if (-not $NoBackup) { Invoke-Backup $SettingsPath }
if (-not (Test-Path -LiteralPath $SettingsDir)) { New-Item -ItemType Directory -Path $SettingsDir -Force | Out-Null }
Write-JsonFile $SettingsPath $settings 100
Write-Host ("  Written  : {0}" -f $SettingsPath) -ForegroundColor Green

if ($needsKey -and -not $SkipVerify) {
  $probeUrl = $effBaseUrl
  if ($Provider -ieq 'shellshock') {
    # Claude Code appends /v1/messages to the base URL; ShellShock itself
    # serves the OpenAI surface under the same /v1 root.
    Write-Host "  Reminder : keep ShellShock running (cd ShellShock; npm run launch)." -ForegroundColor DarkGray
  }
  Test-Endpoint $probeUrl $effKey
}

Write-Host ""
Write-Host "Done. Start Claude Code and run /status to confirm the endpoint." -ForegroundColor Cyan
Write-Host "To revert: .\switch-claude-code.ps1 -Provider anthropic" -ForegroundColor DarkGray
