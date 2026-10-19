# Claude Code on this workstation — free and low-cost models

This project ships a one-command switcher for Claude Code so you are never
locked to one AI provider. Full details: [scripts/claude-code/README.md](scripts/claude-code/README.md).

```powershell
cd scripts\claude-code
.\switch-claude-code.ps1 -List     # see every profile
.\switch-claude-code.ps1 -Show     # what Claude Code uses right now
```

| Profile | Endpoint | Cost |
|---|---|---|
| `shellshock` | `http://localhost:20128/v1` (local gateway in `ShellShock/`) | Free models |
| `radox` | `https://radoxai.com/v1` | Free promo (may end) |
| `beatapi` | `https://api.beatapi.io/v1` | Free promo (GLM 5.3, DeepSeek v4.1, JEV) |
| `deepseek` | `https://api.deepseek.com/anthropic` | Very low per-token |
| `zai` | `https://api.z.ai/api/anthropic` | GLM coding plan |
| `kimi` | `https://api.moonshot.ai/anthropic` | Moonshot per-token |
| `anthropic` | stock | Your Claude subscription |

## Start here (free, no subscription)

1. Start the local gateway:
   ```powershell
   cd ShellShock
   npm run launch
   ```
2. In the ShellShock dashboard → **Endpoint & Key → Create API key**,
   then **Models → pick a Ready model**.
3. Point Claude Code at it (paste the key when asked):
   ```powershell
   cd ..\scripts\claude-code
   .\switch-claude-code.ps1 -Provider shellshock
   ```
4. Start `claude`, run `/status`, and confirm the endpoint.

## Safety rules (already enforced by the scripts)

- Keys are **never** written into the repo: `profiles.json` has endpoints
  only; keys live in `scripts/claude-code/keys.local.json` (git-ignored),
  environment variables, or `~/.claude/settings.json`.
- Every switch backs up `~/.claude/settings.json` with a timestamp
  (last 10 kept) — `switch-claude-code.ps1 -Provider anthropic` reverts.
- Files are written UTF-8 **without BOM**, which Claude Code's JSON parser
  requires.
