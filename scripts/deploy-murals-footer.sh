#!/bin/sh
set -eu
test "$#" -eq 1
asset_sha=$1
base=/www/vhosts/27769
live=$base/iconamaster.ru
stage=$base/iconamaster.ru.stage-murals-footer-20260915
backup=$base/iconamaster.ru.rollback-before-murals-footer-20260915
test "$(readlink -f "$live")" = /www/vhosts/27769/iconamaster.ru
test ! -e "$stage"
test ! -e "$backup"
test "$(sha256sum "$live/assets/index-DGQUm73i.js" | cut -d ' ' -f 1)" = 0407fa54a115bfb0449c7b2388a46a776adf9c2ce96605ee946166db1633522e
test "$(sha256sum "$base/index-Dff30IsG.js" | cut -d ' ' -f 1)" = "$asset_sha"
exec 9>"$live/.editor-state/write.lock"
flock -x 9
cp -a "$live" "$stage"
cp "$base/index-Dff30IsG.js" "$stage/assets/index-Dff30IsG.js"
perl - "$stage" <<'PERL'
use strict;
use warnings;
use File::Find;
my $root = shift;
die "Wrong stage" unless $root eq '/www/vhosts/27769/iconamaster.ru.stage-murals-footer-20260915';
my $count = 0;
find({ no_chdir => 1, wanted => sub {
    return unless -f $_ && /\.html$/;
    open my $in, '<', $_ or die $!;
    local $/; my $html = <$in>; close $in;
    my $changed = ($html =~ s{/assets/index-DGQUm73i\.js}{/assets/index-Dff30IsG.js}g);
    if ($changed) {
        open my $out, '>', $_ or die $!; print $out $html; close $out or die $!;
        $count++;
    }
}}, $root);
die "No bundle references" unless $count > 0;
my $file = "$root/raschistka-hramovyh-rospisey/index.html";
open my $in, '<', $file or die $!; local $/; my $html = <$in>; close $in;
my $offset = index($html, '<footer');
die "Missing footer" if $offset < 0;
my $footer = substr($html, $offset);
my $old = 'https://wa.me/79166554595?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BD%D1%81%D1%83%D0%BB%D1%8C%D1%82%D0%B0%D1%86%D0%B8%D1%8E%20%D0%BE%D0%B1%20%D0%B8%D0%BA%D0%BE%D0%BD%D0%B0%D1%85%20%D0%BC%D0%B0%D1%81%D1%82%D0%B5%D1%80%D1%81%D0%BA%D0%BE%D0%B9.';
my $new = 'https://wa.me/79166554595?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%9D%D1%83%D0%B6%D0%BD%D0%B0%20%D0%BA%D0%BE%D0%BD%D1%81%D1%83%D0%BB%D1%8C%D1%82%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D0%BE%20%D1%80%D0%B0%D1%81%D1%87%D0%B8%D1%81%D1%82%D0%BA%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D0%B5%D0%BD%D0%BD%D1%8B%D1%85%20%D1%85%D1%80%D0%B0%D0%BC%D0%BE%D0%B2%D1%8B%D1%85%20%D1%80%D0%BE%D1%81%D0%BF%D0%B8%D1%81%D0%B5%D0%B9.';
my $replaced = ($footer =~ s/\Q$old\E/$new/g);
die "Expected exactly one footer WhatsApp" unless $replaced == 1;
substr($html, $offset) = $footer;
open my $out, '>', $file or die $!; print $out $html; close $out or die $!;
print "UPDATED_HTML_REFERENCES=$count\n";
PERL
for file in "$live"/content/*.json; do cmp "$file" "$stage/content/$(basename "$file")"; done
cmp "$live/config.php" "$stage/config.php"
cmp "$live/corona/admin/index.php" "$stage/corona/admin/index.php"
ln -f "$live/.editor-state/write.lock" "$stage/.editor-state/write.lock"
test "$live/.editor-state/write.lock" -ef "$stage/.editor-state/write.lock"
mv "$live" "$backup"
if ! mv "$stage" "$live"; then mv "$backup" "$live"; exit 1; fi
printf 'PUBLISHED=murals-footer-20260915\nBACKUP=%s\n' "$backup"

