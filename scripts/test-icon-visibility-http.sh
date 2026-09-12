#!/bin/sh
set -eu
base=/www/vhosts/27769
root=$base/editor-test-visibility-20260912
test "$(readlink -f "$root")" = /www/vhosts/27769/editor-test-visibility-20260912
cd "$root"
/usr/local/bin/php82 -S 127.0.0.1:18969 -t "$root" "$base/live-editor-http-router.php" > "$base/visibility-http-test.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT HUP INT TERM
attempt=0
until curl -fsS http://127.0.0.1:18969/content/icons.json -o /dev/null; do
  attempt=$((attempt+1)); test "$attempt" -lt 10; sleep 1
done
/usr/local/bin/php52 "$base/icon-visibility-http.php"
