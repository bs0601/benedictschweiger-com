# Gary Weekly Cron

## weekly-review.sh

Runs every Monday at 09:00 GMT-3 (12:00 UTC). Syncs Instagram metrics, generates the weekly content review, and sends the digest to Bene via Telegram.

### Prerequisites

- `~/workspace/memory/credentials.env` must contain `GARY_TELEGRAM_BOT_TOKEN`
- `INSTAGRAM_GRAPH_API_TOKEN` in the same file (optional — sync is skipped if missing)
- `jq` must be installed
- Node.js available on PATH

### Register with crontab

```bash
crontab -e
```

Add this line:

```
0 12 * * 1 /Users/openclaw/benedictschweiger-com/gary/cron/weekly-review.sh >> /tmp/gary-weekly-review.log 2>&1
```

This runs at 12:00 UTC every Monday (= 09:00 GMT-3).
