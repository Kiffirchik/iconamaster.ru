#!/bin/sh
# Run only after the verified source commit has been pushed.
set -eu
mode=${1:?prepare or publish}
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-direct-launch-20260909
backup=$base/iconamaster.ru.rollback-before-direct-launch-20260909
archive=$base/iconamaster-direct-launch-20260909.tar.gz
baseline=$base/direct-launch-before-20260909.sha256
expected=$base/direct-launch-after-20260909.sha256
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
case "$mode" in
prepare)
  test ! -e "$stage"
  test ! -e "$backup"
  (cd "$live" && sha256sum content/*.json) > "$baseline"
  test "$(sha256sum "$live/content/articles.json" | cut -d ' ' -f 1)" = b2d9d852762459c4e1e4fb82b481be8ac7a5b6ef9ef73367ab8c1f40c0723bbe
  test "$(sha256sum "$live/content/icons.json" | cut -d ' ' -f 1)" = 23a5dbb22682c0224157d6bfd7243af899e9f228289feea90d08e2fdf02a08ab
  mkdir "$stage"
  for name in corona config.php uploads captcha; do
    test ! -e "$live/$name" || cp -a "$live/$name" "$stage/"
  done
  tar -xzf "$archive" -C "$stage"
  for file in "$live"/content/*.json; do
    name=$(basename "$file")
    if test "$name" != icons.json; then
      cmp "$file" "$stage/content/$name"
      cp -p "$file" "$stage/content/$name"
    fi
  done
  /usr/local/bin/php52 "$base/direct-launch-inventory-20260909.php" "$live" "$stage"
  if test -d "$live/.editor-state"; then cp -a "$live/.editor-state/." "$stage/.editor-state/"; fi
  cp -p "$live/content/icons.json" "$stage/.editor-state/icons-before-direct-launch-20260909.json"
  chmod 600 "$stage/.editor-state/icons-before-direct-launch-20260909.json"
  chmod 700 "$stage/.editor-state"
  for file in "$stage"/corona/admin/content.php "$stage"/corona/admin/text-editor/*.php "$stage"/content-page.php; do /usr/local/bin/php52 -l "$file"; done
  /usr/local/bin/php52 "$base/direct-launch-render-20260909.php" "$stage"
  /usr/local/bin/php52 "$base/direct-launch-status-20260909.php" "$stage"
  (cd "$stage" && sha256sum content/*.json) > "$expected"
  (cd "$live" && sha256sum -c "$baseline")
  echo 'Prepared and verified; production unchanged.'
  ;;
publish)
  test -d "$stage"
  test ! -e "$backup"
  # Serialize the final content check and cutover with the live text editor.
  exec 9>"$live/.editor-state/write.lock"
  flock -x 9
  (cd "$live" && sha256sum -c "$baseline")
  (cd "$stage" && sha256sum -c "$expected")
  if test -d "$live/.editor-state"; then cp -a "$live/.editor-state/." "$stage/.editor-state/"; fi
  cmp "$live/config.php" "$stage/config.php"
  # Queued old requests and new requests must continue to share the same lock inode.
  ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
  test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
  mv "$live" "$backup"
  if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
  echo "Published direct-launch-20260909; rollback: $backup"
  ;;
*) echo 'Unknown mode'; exit 1;;
esac
