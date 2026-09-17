#!/bin/sh
set -eu
test "$#" -eq 3
base=/www/vhosts/27769
payload=$base/metrika-pageviews-20260917
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-metrika-pageviews-20260917
backup=$base/iconamaster.ru.rollback-before-metrika-pageviews-20260917
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
test ! -e "$stage"
test ! -e "$backup"
test "$(sha256sum "$live/assets/index-Dff30IsG.js" | cut -d ' ' -f 1)" = 7cf14c8e8fbcaa68c4301df041c40752d6754041e741a9edeb8cb8251e683b25
test "$(sha256sum "$payload/index-BMdMxOp0.js" | cut -d ' ' -f 1)" = "$1"
test "$(sha256sum "$payload/metrika-script.html" | cut -d ' ' -f 1)" = "$2"
test "$(sha256sum "$payload/patch-metrika-pageviews.php" | cut -d ' ' -f 1)" = "$3"
/usr/local/bin/php52 -l "$payload/patch-metrika-pageviews.php"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
cp -a "$live" "$stage"
cp "$payload/index-BMdMxOp0.js" "$stage/assets/index-BMdMxOp0.js"
/usr/local/bin/php52 "$payload/patch-metrika-pageviews.php" "$stage"
for file in "$live"/content/*.json; do cmp "$file" "$stage/content/$(basename "$file")"; done
diff -qr "$live/.editor-state" "$stage/.editor-state"
cmp "$live/config.php" "$stage/config.php"
cmp "$live/corona/admin/index.php" "$stage/corona/admin/index.php"
cmp "$live/yandex_b791bc412a0fe092.html" "$stage/yandex_b791bc412a0fe092.html"
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
printf 'PUBLISHED=metrika-pageviews-20260917\nBACKUP=%s\n' "$backup"
