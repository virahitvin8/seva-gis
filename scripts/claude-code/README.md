# Claude Code provider switcher (SEVA.GIS workstation)

One script switches Claude Code between a local free-model gateway, free
promo endpoints and official Anthropic — without pasting keys into chat or
into any tracked file.

```
scripts/claude-code/
├─ profiles.json            # provider endpoints + model defaults (no secrets)
├─ switch-claude-code.ps1   # the switcher
└─ keys.local.json          # created on first -SaveKey (git-ignored)
```

## Quick reference

| Profile | Endpoint | Cost |
|---|---|---|
| `shellshock` | `http://localhost:20128/v1` | Free models (local gateway) |
| `radox` | `https://radoxai.com/v1` | Free promo (can end anytime) |
| `beatapi` | `https://api.beatapi.io/v1` | Free promo (GLM 5.3, DeepSeek v4.1, JEV) |
| `deepseek` | `https://api.deepseek.com/anthropic` | Very low pay-per-token |
| `zai` | `https://api.z.ai/api/anthropic` | GLM coding plan |
| `kimi` | `https://api.moonshot.ai/anthropic` | Moonshot pay-per-token |
| `anthropic` | — (stock) | Your Claude subscription |

## 1. Start ShellShock (free models)

The gateway lives in this repo at `ShellShock/` (git-ignored).

```powershell
cd ShellShock
npm run launch
```

- First run installs dependencies, builds the dashboard (a few minutes) and
  opens `http://localhost:20128`.
- In the dashboard: **Endpoint & Key → Create API key**, then **Models →
  pick a “Ready” model** (OpenCode Free models need no signup; connect more
  free providers for Kiro, OpenRouter free models, NVIDIA NIM, Groq, etc.).
- Keep that window running while you code — the models only work then.

## 2. Point Claude Code at it

```powershell
cd "scripts/claude-code"
.\switch-claude-code.ps1 -Provider shellshock
# paste the key you created in the ShellShock dashboard when asked
```

The script writes `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128/v1",
    "ANTHROPIC_AUTH_TOKEN": "<shellshock key>",
    "API_TIMEOUT_MS": "600000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

Then start `claude` and run `/status` to confirm.

## 3. Other providers

```powershell
.\switch-claude-code.ps1 -Provider radox    -Key <radox-key>    -SaveKey
.\switch-claude-code.ps1 -Provider deepseek -Key <deepseek-key> -SaveKey
.\switch-claude-code.ps1 -Provider zai      -Key <zai-key>      -SaveKey
.\switch-claude-code.ps1 -Provider kimi     -Key <kimi-key>     -SaveKey
```

If a provider renames its models, override every slot in one go:

```powershell
.\switch-claude-code.ps1 -Provider deepseek -Model deepseek-chat
```

Any other Anthropic-compatible endpoint (including a ShellShock custom
endpoint for OpenAI-only providers such as Radox or the Kimi coding plan):

```powershell
.\switch-claude-code.ps1 -Provider custom -BaseUrl <url> -Key <key>
```

## 4. Inspect and revert

```powershell
.\switch-claude-code.ps1 -List      # show all profiles
.\switch-claude-code.ps1 -Show      # show what Claude Code uses right now
.\switch-claude-code.ps1 -Provider anthropic   # back to stock
```

Every switch writes a timestamped backup next to `settings.json`
(`settings.json.bak-YYYYMMDD-HHMMSS`, last 10 kept).

## Notes and troubleshooting

- **404 on `/v1/messages`** — the provider only speaks OpenAI format. Route it
  through ShellShock: dashboard → **Connections → Custom endpoint**, then use
  `-Provider custom -BaseUrl http://localhost:20128/v1 -Key <shellshock key>`.
- **Radox** is a third-party aggregator from a promo post; treat it as
  best-effort and never rely on it for anything private.
- **Keys** are stored only in `scripts/claude-code/keys.local.json`
  (git-ignored) / environment variables / `~/.claude/settings.json`. Never
  commit them; rotate anything that has ever appeared in a screenshot, chat
  or commit.
- **Windows PowerShell 5.1** is supported (this script avoids PS7-only
  syntax).
- The old `sk-sim-*` token in your previous `settings.json` is preserved in
  the automatic backups — revoke it if it is not yours anymore.
