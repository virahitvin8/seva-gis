#!/usr/bin/env bash
# ==============================================================================
# DYOP·GIS / SEVA·GIS — Claude Code Multi-Model & API Endpoint Configurator
# Supports: RadoxAI (radoxai.com/v1), BeatAPI (api.beatapi.io/v1),
#           DeepSeek V4.1, Zhipu GLM-5.3 Flash, Gemini 4 Argon, or Local Ollama
# ==============================================================================
set -euo pipefail

PRESET="${1:-radoxai}"
API_KEY="${2:-${ANTHROPIC_AUTH_TOKEN:-YOUR_API_KEY_HERE}}"

case "$PRESET" in
  radoxai)
    BASE_URL="https://radoxai.com/v1"
    PRIMARY_MODEL="claude-opus-5.5"
    FAST_MODEL="fable-5.1"
    OPUS_MODEL="gpt-5.6-sol"
    ;;
  beatapi)
    BASE_URL="https://api.beatapi.io/v1"
    PRIMARY_MODEL="glm-5.3"
    FAST_MODEL="glm-5.3-flash"
    OPUS_MODEL="jev-1.13"
    ;;
  deepseek)
    BASE_URL="https://api.deepseek.com/anthropic"
    PRIMARY_MODEL="deepseek-v4.1"
    FAST_MODEL="glm-5.3-flash"
    OPUS_MODEL="deepseek-reasoner"
    ;;
  ollama)
    BASE_URL="http://localhost:11434/v1"
    PRIMARY_MODEL="qwen3-coder:32b"
    FAST_MODEL="deepseek-r1:14b"
    OPUS_MODEL="glm-5-local:latest"
    ;;
  *)
    BASE_URL="$PRESET"
    PRIMARY_MODEL="${3:-claude-opus-5.5}"
    FAST_MODEL="${4:-glm-5.3-flash}"
    OPUS_MODEL="${5:-claude-opus-5.5}"
    ;;
esac

mkdir -p "$HOME/.claude" ".claude"

cat > ".claude/settings.local.json" <<EOF
{
  "\$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "${BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "${API_KEY}",
    "ANTHROPIC_API_KEY": "${API_KEY}",
    "ANTHROPIC_MODEL": "${PRIMARY_MODEL}",
    "ANTHROPIC_SMALL_FAST_MODEL": "${FAST_MODEL}",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "${PRIMARY_MODEL}",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "${OPUS_MODEL}",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "${FAST_MODEL}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "API_TIMEOUT_MS": "600000"
  }
}
EOF

cp ".claude/settings.local.json" "$HOME/.claude/settings.json"
echo "Configured Claude Code settings.json -> ${BASE_URL} (Primary: ${PRIMARY_MODEL}, Fast: ${FAST_MODEL})"
