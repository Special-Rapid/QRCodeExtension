#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

case "$MODE" in
  start|run) exec npx expo start ;;
  --ios|ios) exec npx expo start --ios ;;
  --android|android) exec npx expo start --android ;;
  --web|web) exec npx expo start --web ;;
  --dev-client|dev-client) exec npx expo start --dev-client ;;
  --tunnel|tunnel) exec npx expo start --tunnel ;;
  --export-web|export-web) exec npx expo export --platform web ;;
  --doctor|doctor) exec npx expo-doctor ;;
  --help|help)
    echo "usage: ./script/build_and_run.sh [start|--ios|--android|--web|--dev-client|--tunnel|--export-web|--doctor]"
    ;;
  *)
    echo "unknown mode: $MODE" >&2
    exit 2
    ;;
esac
