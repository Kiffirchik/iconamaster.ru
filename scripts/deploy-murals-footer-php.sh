#!/bin/sh
set -eu
test "$#" -eq 2
asset_sha=$1
patch_sha=$2
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-murals-footer-20260915-v2
backup=$base/iconamaster.ru.rollback-before-murals-footer-20260915
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
test ! -e "$stage"
test ! -e "$backup"
test "$(sha256sum "$live/assets/index-DGQUm73i.js" | cut -d ' ' -f 1)" = 0407fa54a115bfb0449c7b2388a46a776adf9c2ce96605ee946166db1633522e
test "$(sha256sum "$base/index-Dff30IsG.js" | cut -d ' ' -f 1)" = "$asset_sha"
test "$(sha256sum "$base/patch-murals-footer-20260915.php" | cut -d ' ' -f 1)" = "$patch_sha"
/usr/local/bin/php52 -l "$base/patch-murals-footer-20260915.php"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
cp -a "$live" "$stage"
cp "$base/index-Dff30IsG.js" "$stage/assets/index-Dff30IsG.js"
/usr/local/bin/php52 "$base/patch-murals-footer-20260915.php" "$stage"
for file in "$live"/content/*.json; do cmp "$file" "$stage/content/$(basename "$file")"; done
cmp "$live/config.php" "$stage/config.php"
cmp "$live/corona/admin/index.php" "$stage/corona/admin/index.php"
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
printf 'PUBLISHED=murals-footer-20260915\nBACKUP=%s\n' "$backup"

