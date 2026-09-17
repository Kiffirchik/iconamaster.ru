#!/bin/sh
# Content-only release from the verified, pushed source. Preserve all other files.
set -eu
test "$#" -eq 5
payload_sha=$1
articles_sha=$2
apache_sha=$3
routes_sha=$4
sitemap_sha=$5
for digest in "$payload_sha" "$articles_sha" "$apache_sha" "$routes_sha" "$sitemap_sha"; do
  case "$digest" in *[!0-9a-f]*) exit 1;; esac
  test "${#digest}" -eq 64
done
base=/www/vhosts/27769
release=articles-20260917
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-$release
backup=$base/iconamaster.ru.rollback-before-$release
archive=$base/iconamaster.ru.before-$release.tar.gz
payload=$base/iconamaster-$release.tar.gz
incoming=$base/iconamaster.payload-$release
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
for item in "$stage" "$backup" "$archive" "$incoming"; do test ! -e "$item"; done
test "$(sha256sum "$payload" | cut -d ' ' -f 1)" = "$payload_sha"
test -d "$live/.editor-state"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
test "$(sha256sum "$live/content/articles.json" | cut -d ' ' -f 1)" = "$articles_sha"
test "$(sha256sum "$live/.htaccess" | cut -d ' ' -f 1)" = "$apache_sha"
test "$(sha256sum "$live/.live-templates/routes.json" | cut -d ' ' -f 1)" = "$routes_sha"
test "$(sha256sum "$live/.live-templates/sitemap.xml" | cut -d ' ' -f 1)" = "$sitemap_sha"
test "$(sha256sum "$live/assets/index-BMdMxOp0.js" | cut -d ' ' -f 1)" = dff72e2bb0b8c4309f34927083405f82712e12087d2700cc562b56dd4588de4a
tar -czf "$archive" -C "$base" iconamaster.ru
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/content/articles.json'
mkdir "$incoming"
tar -xzf "$payload" -C "$incoming"
cp -a "$live" "$stage"
cp -a "$incoming/." "$stage/"
for slug in icon-painting-pigments levkas gold-leaf-gilding; do
  test -f "$stage/articles/$slug/index.html"
  grep -Fq "\"/articles/$slug\":" "$stage/.live-templates/routes.json"
done
for file in "$live"/content/*.json; do
  name=$(basename "$file")
  if test "$name" != articles.json; then cmp "$file" "$stage/content/$name"; fi
done
cmp "$live/config.php" "$stage/config.php"
diff -qr "$live/corona" "$stage/corona"
diff -qr "$live/.editor-state" "$stage/.editor-state"
/usr/local/bin/php52 -l "$stage/content-page.php"
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
sha256sum "$archive" "$payload" "$live/content/articles.json"
