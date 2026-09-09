#!/bin/sh
# Two-phase, content-preserving publication; source must be pushed before publish.
set -eu
mode=${1:?prepare or publish}
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-direct-20260909
backup=$base/iconamaster.ru.rollback-before-direct-20260909
archive=$base/iconamaster-direct-20260909.tar.gz
baseline=$base/direct-baseline-20260909.sha256
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
case "$mode" in
prepare)
  test ! -e "$stage"
  test ! -e "$backup"
  (cd "$live" && sha256sum content/*.json) > "$baseline"
  # Stop if another publication has changed the content used for this build.
  test "$(sha256sum "$live/content/articles.json" | cut -d ' ' -f 1)" = a422a95700637ccaff434b20dc3d07d0e0b7d750e7bf25f96139f639f94b7448
  test "$(sha256sum "$live/content/icons.json" | cut -d ' ' -f 1)" = 23a5dbb22682c0224157d6bfd7243af899e9f228289feea90d08e2fdf02a08ab
  mkdir "$stage"
  for name in corona config.php uploads captcha; do
    test ! -e "$live/$name" || cp -a "$live/$name" "$stage/"
  done
  tar -xzf "$archive" -C "$stage"
  for file in "$live"/content/*.json; do cp -p "$file" "$stage/content/"; done
  if test -d "$live/.editor-state"; then cp -a "$live/.editor-state/." "$stage/.editor-state/"; fi
  chmod 700 "$stage/.editor-state"
  for file in "$stage"/corona/admin/content.php "$stage"/corona/admin/text-editor/*.php "$stage"/content-page.php; do /usr/local/bin/php52 -l "$file"; done
  /usr/local/bin/php52 "$base/direct-render-check-20260909.php" "$stage"
  /usr/local/bin/php52 "$base/direct-status-check-20260909.php" "$stage"
  (cd "$live" && sha256sum -c "$baseline")
  echo 'Prepared and verified; production unchanged.'
  ;;
publish)
  test -d "$stage"
  test ! -e "$backup"
  (cd "$live" && sha256sum -c "$baseline")
  (cd "$stage" && sha256sum -c "$baseline")
  # Refresh edit history immediately before cutover, while preserving all content.
  if test -d "$live/.editor-state"; then cp -a "$live/.editor-state/." "$stage/.editor-state/"; fi
  cmp "$live/config.php" "$stage/config.php"
  mv "$live" "$backup"
  if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
  echo "Published direct-20260909; rollback: $backup"
  ;;
*) echo 'Unknown mode'; exit 1;;
esac
