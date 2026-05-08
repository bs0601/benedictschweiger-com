#!/usr/bin/env bash
# weekly-review.sh — runs Instagram sync + weekly content review, sends digest to Bene via Telegram.
# Intended to run every Monday at 09:00 GMT-3 (12:00 UTC).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load credentials
source ~/workspace/memory/credentials.env

cd "$REPO_ROOT"

# 1. Sync Instagram performance (optional — only if token is set)
if [ -n "${INSTAGRAM_GRAPH_API_TOKEN:-}" ]; then
  echo "Syncing Instagram performance..."
  node scripts/sync-instagram-performance.js
else
  echo "INSTAGRAM_GRAPH_API_TOKEN not set — skipping Instagram sync"
fi

# 2. Run weekly content review and capture output
echo "Running weekly content review..."
REVIEW_OUTPUT=$(node scripts/weekly-content-review.js)

# 3. Send to Bene via Telegram
CHAT_ID="7542560867"
BOT_TOKEN="$GARY_TELEGRAM_BOT_TOKEN"

echo "Sending weekly review to Bene via Telegram..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg chat_id "$CHAT_ID" --arg text "$REVIEW_OUTPUT" \
    '{chat_id: $chat_id, text: $text, parse_mode: "Markdown"}')"

echo "Done."
