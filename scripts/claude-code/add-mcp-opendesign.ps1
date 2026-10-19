param(
  [string]$GrokApiKey = $env:GROK_API_KEY
)

$settingsPath = Join-Path $env:USERPROFILE ".claude\settings.json"
if (-not (Test-Path $settingsPath)) {
  throw "settings.json not found at $settingsPath"
}

$settings = Get-Content $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json

$mcpConfig = [ordered]@{
  "open-design" = [ordered]@{
    "command" = "C:\Users\neela\AppData\Local\Programs\Open Design\Open Design.exe"
    "args" = @(
      "C:\Users\neela\AppData\Local\Programs\Open Design\resources\app\prebundled\daemon\daemon-cli.mjs",
      "mcp"
    )
    "env" = [ordered]@{
      "OD_DATA_DIR" = "C:\\Users\\neela\\AppData\\Roaming\\Open Design\\namespaces\\release-stable-win\\data"
      "OD_SIDECAR_CLIENT_ENDPOINT" = "\\\\.\\pipe\\open-design-sidecar-01a2a040826cec425c96efa6dd6776ac"
      "OD_MCP_BOOTSTRAP_COMMAND" = "C:\Users\neela\AppData\Local\Programs\Open Design\Open Design.exe"
      "OD_MCP_BOOTSTRAP_ARGS" = '["--headless"]'
      "ELECTRON_RUN_AS_NODE" = "1"
    }
  }
}

if (-not [string]::IsNullOrWhiteSpace($GrokApiKey)) {
  $mcpConfig["open-design"]["env"]["GROK_API_KEY"] = $GrokApiKey
}

if ($null -eq $settings.PSObject.Properties['mcpServers']) {
  $settings | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue (New-Object PSCustomObject) -Force
}

$settings.mcpServers | Add-Member -NotePropertyName "open-design" -NotePropertyValue ($mcpConfig["open-design"]) -Force

$jsonOut = $settings | ConvertTo-Json -Depth 50
[System.IO.File]::WriteAllText($settingsPath, $jsonOut, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Open Design MCP successfully configured in $settingsPath" -ForegroundColor Green
