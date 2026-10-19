# ==============================================================================
# DYOP·GIS / SEVA·GIS — Windows PowerShell Claude Code Model Configurator
# Usage: .\scripts\setup-claude-code-models.ps1 -Preset "radoxai" -ApiKey "sk-..."
# ==============================================================================
param(
  [string]$Preset = "radoxai",
  [string]$ApiKey = "YOUR_API_KEY_HERE"
)

$BaseUrl = "https://radoxai.com/v1"
$PrimaryModel = "claude-opus-5.5"
$FastModel = "glm-5.3-flash"
$OpusModel = "gpt-5.6-sol"

switch ($Preset.ToLower()) {
  "beatapi" {
    $BaseUrl = "https://api.beatapi.io/v1"
    $PrimaryModel = "glm-5.3"
    $FastModel = "glm-5.3-flash"
    $OpusModel = "jev-1.13"
  }
  "deepseek" {
    $BaseUrl = "https://api.deepseek.com/anthropic"
    $PrimaryModel = "deepseek-v4.1"
    $FastModel = "glm-5.3-flash"
    $OpusModel = "deepseek-reasoner"
  }
  "ollama" {
    $BaseUrl = "http://localhost:11434/v1"
    $PrimaryModel = "qwen3-coder:32b"
    $FastModel = "deepseek-r1:14b"
    $OpusModel = "glm-5-local:latest"
  }
}

$ClaudeGlobalDir = Join-Path $HOME ".claude"
if (!(Test-Path $ClaudeGlobalDir)) { New-Item -ItemType Directory -Path $ClaudeGlobalDir | Out-Null }
if (!(Test-Path ".claude")) { New-Item -ItemType Directory -Path ".claude" | Out-Null }

$JsonContent = @"
{
  "`$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "$BaseUrl",
    "ANTHROPIC_AUTH_TOKEN": "$ApiKey",
    "ANTHROPIC_API_KEY": "$ApiKey",
    "ANTHROPIC_MODEL": "$PrimaryModel",
    "ANTHROPIC_SMALL_FAST_MODEL": "$FastModel",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$PrimaryModel",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$OpusModel",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$FastModel",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "API_TIMEOUT_MS": "600000"
  }
}
"@

Set-Content -Path (Join-Path $ClaudeGlobalDir "settings.json") -Value $JsonContent -Encoding UTF8
Set-Content -Path ".claude\settings.local.json" -Value $JsonContent -Encoding UTF8
Write-Host "Claude Code configured for $PrimaryModel via $BaseUrl" -ForegroundColor Green
