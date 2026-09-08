#!/bin/sh
# Run over SSH as the site's owner. Artifact must be built from a pushed commit.
set -eu
release=${1:?release id required}
case "$release" in *[!a-zA-Z0-9-]*|'') echo 'Invalid release id'; exit 1;; esac
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-live-$release
backup=$base/iconamaster.ru.rollback-before-live-$release
archive=$base/iconamaster-live-$release.tar.gz
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
test ! -e "$stage"
test ! -e "$backup"
test -f "$archive"
mkdir "$stage"
# Preserve legacy login, configuration and uploads; overlay only the new build.
for name in corona config.php uploads captcha; do
    test ! -e "$live/$name" || cp -a "$live/$name" "$stage/"
done
tar -xzf "$archive" -C "$stage"
# Hosting content is authoritative. Future releases must not replace saved text.
for file in "$live"/content/*.json; do cp -p "$file" "$stage/content/"; done
if test -d "$live/.editor-state"; then cp -a "$live/.editor-state/." "$stage/.editor-state/"; fi
chmod 700 "$stage/.editor-state"
for file in "$stage"/corona/admin/content.php "$stage"/corona/admin/text-editor/*.php "$stage"/content-page.php; do /usr/local/bin/php52 -l "$file"; done
# Check data did not change while staging. Abort instead of discarding edits.
for file in "$live"/content/*.json; do cmp "$file" "$stage/content/$(basename "$file")"; done
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
echo "Published $release; rollback: $backup"
