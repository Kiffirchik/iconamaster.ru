#!/bin/sh
set -eu
release=${1:?new-icons release id required}
payload_sha=${2:?payload sha required}
migration_sha=${3:?migration sha required}
additions_sha=${4:?additions sha required}
case "$release" in new-icons-[a-zA-Z0-9-]*) ;; *) exit 1;; esac
case "$release" in *[!a-zA-Z0-9-]*) exit 1;; esac
case "$payload_sha" in *[!0-9a-f]*) exit 1;; esac
test "${#payload_sha}" -eq 64
for digest in "$migration_sha" "$additions_sha"; do
  case "$digest" in *[!0-9a-f]*) exit 1;; esac
  test "${#digest}" -eq 64
done
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-$release
backup=$base/iconamaster.ru.rollback-before-$release
archive=$base/iconamaster.ru.before-$release.tar.gz
payload=$base/iconamaster-$release.tar.gz
incoming=$base/iconamaster.payload-$release
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
for path in "$stage" "$backup" "$archive" "$incoming"; do test ! -e "$path"; done
test "$(sha256sum "$payload" | cut -d ' ' -f 1)" = "$payload_sha"
test "$(sha256sum "$base/append-new-icons-20260912.php" | cut -d ' ' -f 1)" = "$migration_sha"
test "$(sha256sum "$base/new-icons-20260912.json" | cut -d ' ' -f 1)" = "$additions_sha"
test -f "$live/corona/admin/index.php"
test -f "$live/config.php"
test -d "$live/.editor-state"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
tar -czf "$archive" -C "$base" iconamaster.ru
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/corona/admin/index.php'
tar -tzf "$archive" | grep -Fq 'iconamaster.ru/content/icons.json'
mkdir "$incoming"
tar -xzf "$payload" -C "$incoming"
test -f "$incoming/corona/admin/text-editor/pricing.php"
cp -a "$live" "$stage"
cp -a "$incoming/." "$stage/"
# Live JSON is authoritative, including changes made after local tests.
for file in "$live"/content/*.json; do cp -p "$file" "$stage/content/"; done
/usr/local/bin/php52 "$base/append-new-icons-20260912.php" "$stage" "$base/new-icons-20260912.json"
for file in "$live"/content/*.json; do
  name=$(basename "$file")
  if test "$name" != icons.json; then cmp "$file" "$stage/content/$name"; fi
done
cmp "$live/config.php" "$stage/config.php"
cmp "$live/corona/admin/index.php" "$stage/corona/admin/index.php"
for file in "$stage"/corona/admin/text-editor/*.php "$stage/content-page.php" "$stage/corona/admin/content.php"; do /usr/local/bin/php52 -l "$file"; done
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
printf 'PUBLISHED=%s\nBACKUP=%s\nARCHIVE=%s\n' "$release" "$backup" "$archive"
sha256sum "$archive" "$payload" "$live/content/icons.json"
