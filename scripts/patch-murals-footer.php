<?php
error_reporting(E_ALL);
function ensure($ok, $message) { if (!$ok) { fwrite(STDERR, $message . "\n"); exit(1); } }
$root = isset($argv[1]) ? $argv[1] : '';
ensure($root === '/www/vhosts/27769/iconamaster.ru.stage-murals-footer-20260915-v2', 'Wrong stage');
ensure(realpath($root) === $root, 'Stage path mismatch');
function patchHtml($directory) {
    $count = 0;
    foreach (scandir($directory) as $name) {
        if ($name === '.' || $name === '..') continue;
        $file = $directory . '/' . $name;
        if (is_link($file)) continue;
        if (is_dir($file)) { $count += patchHtml($file); continue; }
        if (substr($name, -5) !== '.html') continue;
        $html = file_get_contents($file);
        ensure($html !== false, 'Cannot read HTML');
        $patched = str_replace('/assets/index-DGQUm73i.js', '/assets/index-Dff30IsG.js', $html);
        if ($html !== $patched) {
            ensure(file_put_contents($file, $patched) === strlen($patched), 'Cannot write HTML');
            $count++;
        }
    }
    return $count;
}
$count = patchHtml($root);
ensure($count > 0, 'No bundle references');
$file = $root . '/raschistka-hramovyh-rospisey/index.html';
$html = file_get_contents($file);
ensure($html !== false, 'Cannot read service page');
$offset = strpos($html, '<footer');
ensure($offset !== false, 'Missing footer');
$footer = substr($html, $offset);
$old = 'https://wa.me/79166554595?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BD%D1%81%D1%83%D0%BB%D1%8C%D1%82%D0%B0%D1%86%D0%B8%D1%8E%20%D0%BE%D0%B1%20%D0%B8%D0%BA%D0%BE%D0%BD%D0%B0%D1%85%20%D0%BC%D0%B0%D1%81%D1%82%D0%B5%D1%80%D1%81%D0%BA%D0%BE%D0%B9.';
$new = 'https://wa.me/79166554595?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%9D%D1%83%D0%B6%D0%BD%D0%B0%20%D0%BA%D0%BE%D0%BD%D1%81%D1%83%D0%BB%D1%8C%D1%82%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D0%BE%20%D1%80%D0%B0%D1%81%D1%87%D0%B8%D1%81%D1%82%D0%BA%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D0%B5%D0%BD%D0%BD%D1%8B%D1%85%20%D1%85%D1%80%D0%B0%D0%BC%D0%BE%D0%B2%D1%8B%D1%85%20%D1%80%D0%BE%D1%81%D0%BF%D0%B8%D1%81%D0%B5%D0%B9.';
ensure(substr_count($footer, $old) === 1, 'Expected exactly one footer WhatsApp');
$patched = substr($html, 0, $offset) . str_replace($old, $new, $footer);
ensure(file_put_contents($file, $patched) === strlen($patched), 'Cannot write service page');
echo "UPDATED_HTML_REFERENCES=" . $count . "\n";

