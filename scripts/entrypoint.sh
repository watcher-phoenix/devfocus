#!/bin/bash
set -e

DB_PATH="/data/devfocus.sqlite3"

# If no database exists, try to restore from Litestream backup
if [ ! -f "$DB_PATH" ]; then
  echo "No database found. Attempting restore from backup..."
  litestream restore -if-replica-exists -config /etc/litestream.yml "$DB_PATH" || true
fi

# Start Litestream replication, which wraps the Node app
exec litestream replicate -exec "node backend/start.js" -config /etc/litestream.yml
