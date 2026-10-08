#!/bin/sh
# Publish the approved homepage spacing without replacing live content or order code.
set -eu
test "$#" -eq 1
payload_sha=$1
case "$payload_sha" in *[!0-9a-f]*) exit 1;; esac
test "${#payload_sha}" -eq 64
base=/www/vhosts/27769
release=card-spacing-20261009
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
while IFS= read -r file; do
  case "$file" in *.html|assets/index-*.css|assets/index-*.js) ;; *) exit 1;; esac
done < "$incoming/actual-files"
for name in content corona .editor-state .htaccess config.php order-request.php; do test ! -e "$incoming/site/$name"; done
test "$(find "$incoming/site/assets" -type f | wc -l)" -eq 2
(cd "$incoming/site" && sha256sum --status -c "$incoming/after.sha256")
exec 9>"$live/.editor-state/write.lock"
flock -x 9
(cd "$live" && sha256sum --status -c "$incoming/before.sha256")
tar -czf "$archive" -C "$base" iconamaster.ru
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/order-request.php'
cp -a "$live" "$stage"
cp -a "$incoming/site/." "$stage/"
(cd "$stage" && sha256sum --status -c "$incoming/after.sha256")
# Every existing non-HTML file remains byte-for-byte identical, including old assets.
find "$live" -type f ! -name '*.html' -print | while IFS= read -r file; do cmp "$file" "$stage/${file#"$live/"}"; done
diff -qr "$live/content" "$stage/content"
diff -qr "$live/corona" "$stage/corona"
diff -qr "$live/.editor-state" "$stage/.editor-state"
/usr/local/bin/php52 "$base/icon-visibility-readiness.php" "$stage"
/usr/local/bin/php52 "$base/check-home-shop-20261007.php" "$stage"
# Private enquiries live outside these roots and are neither read nor modified.
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
restore_if_interrupted() { if test ! -e "$live" && test -d "$backup"; then command mv "$backup" "$live"; fi; }
trap restore_if_interrupted 0
trap 'exit 1' 1 2 15
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
trap - 0 1 2 15
printf 'PUBLISHED=%s\nBACKUP=%s\nARCHIVE=%s\n' "$release" "$backup" "$archive"
sha256sum "$archive" "$payload" "$live/order-request.php"
