#!/bin/sh
# Exercise the real deploy script's swap with a terminating signal between moves.
set -eu
script=${1:?deployment script required}
fixture=$(mktemp -d)
trap 'rm -f "$fixture/swap.sh"; rmdir "$fixture/live" "$fixture/stage" "$fixture/backup" 2>/dev/null || true; rmdir "$fixture"' 0
mkdir "$fixture/live" "$fixture/stage"
sed -n '/^# Directory swap/,$p' "$script" > "$fixture/swap.sh"
test -s "$fixture/swap.sh"
if sh -c '
  set -eu
  live=$1/live; stage=$1/stage; backup=$1/backup
  mv() {
    command mv "$@"
    if test "$1" = "$live"; then kill -TERM $$; fi
  }
  . "$1/swap.sh"
' swap-test "$fixture"; then
  echo 'Expected interruption' >&2; exit 1
fi
test -d "$fixture/live"
test -d "$fixture/stage"
test ! -e "$fixture/backup"
echo 'Interrupted directory swap restores live site'
