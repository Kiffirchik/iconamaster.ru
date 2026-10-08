#!/bin/sh
# Owner-approved order enquiry publication. Existing content and auth stay intact.
set -eu
test "$#" -eq 1
payload_sha=$1
case "$payload_sha" in *[!0-9a-f]*) exit 1;; esac
test "${#payload_sha}" -eq 64
base=/www/vhosts/27769
release=orders-20261008
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-$release
backup=$base/iconamaster.ru.rollback-before-$release
archive=$base/iconamaster.ru.before-$release.tar.gz
payload=$base/iconamaster-$release.tar.gz
incoming=$base/iconamaster.payload-$release
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
for item in "$stage" "$backup" "$archive" "$incoming"; do test ! -e "$item"; done
test "$(sha256sum "$payload" | cut -d ' ' -f 1)" = "$payload_sha"
mkdir "$incoming"
tar -xzf "$payload" -C "$incoming"
test -z "$(find "$incoming/site" -type l -print -quit)"
find "$incoming/site" -type f -printf '%P\n' | LC_ALL=C sort > "$incoming/actual-files"
sed 's/^[0-9a-f]*  //' "$incoming/after.sha256" | LC_ALL=C sort > "$incoming/expected-files"
cmp "$incoming/actual-files" "$incoming/expected-files"
(cd "$incoming/site" && sha256sum --status -c "$incoming/after.sha256")
test ! -e "$incoming/site/content"
test ! -e "$incoming/site/.editor-state"
test ! -e "$incoming/site/.htaccess"
test ! -e "$incoming/site/config.php"
find "$incoming/site/corona" -type f -printf '%P\n' | LC_ALL=C sort > "$incoming/corona-files"
printf '%s\n' admin/orders.php admin/orders/admin.php admin/orders/store.php admin/text-editor/editor.php > "$incoming/allowed-corona-files"
cmp "$incoming/corona-files" "$incoming/allowed-corona-files"
test -f "$incoming/site/order-request.php"
test ! -e "$live/order-request.php"
test ! -e "$live/corona/admin/orders.php"
test ! -e "$live/corona/admin/orders"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
(cd "$live" && sha256sum --status -c "$incoming/before.sha256")
tar -czf "$archive" -C "$base" iconamaster.ru
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/content/icons.json'
cp -a "$live" "$stage"
cp -a "$incoming/site/." "$stage/"
(cd "$stage" && sha256sum --status -c "$incoming/after.sha256")
for file in "$live"/content/*.json; do cmp "$file" "$stage/content/$(basename "$file")"; done
for file in .htaccess config.php content-page.php content-sitemap.php .live-templates/routes.json yandex_b791bc412a0fe092.html; do cmp "$live/$file" "$stage/$file"; done
diff -qr "$live/.editor-state" "$stage/.editor-state"
# Only the inbox link in the editor may replace an existing Corona file.
find "$live/corona" -type f ! -path "$live/corona/admin/text-editor/editor.php" -print | while IFS= read -r file; do cmp "$file" "$stage/${file#"$live/"}"; done
for file in order-request.php corona/admin/orders.php corona/admin/orders/store.php corona/admin/orders/admin.php corona/admin/text-editor/editor.php; do /usr/local/bin/php52 -l "$stage/$file"; done
/usr/local/bin/php52 "$base/icon-visibility-readiness.php" "$stage"
/usr/local/bin/php52 "$base/check-home-shop-20261007.php" "$stage"
# Enquiries are outside both live and staged document roots and survive rollback.
test ! -L "$base/.iconamaster-order-requests"
if test ! -d "$base/.iconamaster-order-requests"; then mkdir -m 700 "$base/.iconamaster-order-requests"; fi
chmod 700 "$base/.iconamaster-order-requests"
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
restore_if_interrupted() { if test ! -e "$live" && test -d "$backup"; then command mv "$backup" "$live"; fi; }
trap restore_if_interrupted 0
trap 'exit 1' 1 2 15
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
trap - 0 1 2 15
printf 'PUBLISHED=%s\nBACKUP=%s\nARCHIVE=%s\n' "$release" "$backup" "$archive"
sha256sum "$archive" "$payload" "$live/content/icons.json" "$live/content/contacts.json"
