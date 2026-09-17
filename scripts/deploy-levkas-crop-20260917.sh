#!/bin/sh
# CSS-only checksummed overlay. All editable data remains live.
set -eu
test "$#" -eq 1
payload_sha=$1
case "$payload_sha" in *[!0-9a-f]*) exit 1;; esac
test "${#payload_sha}" -eq 64
base=/www/vhosts/27769
release=levkas-crop-20260917
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
test -d "$live/.editor-state"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
(cd "$live" && sha256sum --status -c "$incoming/before.sha256")
tar -czf "$archive" -C "$base" iconamaster.ru
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/content/icons.json'
cp -a "$live" "$stage"
cp -a "$incoming/site/." "$stage/"
(cd "$stage" && sha256sum --status -c "$incoming/after.sha256")
for file in "$live"/content/*.json; do
  name=$(basename "$file")
  cmp "$file" "$stage/content/$name"
done
cmp "$live/.htaccess" "$stage/.htaccess"
cmp "$live/config.php" "$stage/config.php"
cmp "$live/content-page.php" "$stage/content-page.php"
cmp "$live/.live-templates/routes.json" "$stage/.live-templates/routes.json"
cmp "$live/yandex_b791bc412a0fe092.html" "$stage/yandex_b791bc412a0fe092.html"
diff -qr "$live/corona" "$stage/corona"
diff -qr "$live/.editor-state" "$stage/.editor-state"
/usr/local/bin/php52 "$base/icon-visibility-readiness.php" "$stage"
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
# Directory swap
restore_if_interrupted() {
  if test ! -e "$live" && test -d "$backup"; then
    command mv "$backup" "$live"
  fi
}
trap restore_if_interrupted 0
trap 'exit 1' 1 2 15
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
trap - 0 1 2 15
printf 'PUBLISHED=%s\nBACKUP=%s\nARCHIVE=%s\n' "$release" "$backup" "$archive"
sha256sum "$archive" "$payload" "$live/content/videos.json"


