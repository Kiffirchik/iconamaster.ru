<?php
error_reporting(E_ALL);
function ensure($ok, $message) { if (!$ok) { fwrite(STDERR, $message . "\n"); exit(1); } }
$root = isset($argv[1]) ? $argv[1] : '';
ensure($root === '/www/vhosts/27769/iconamaster.ru.stage-metrika-pageviews-20260917', 'Wrong stage');
ensure(realpath($root) === $root, 'Stage path mismatch');
$replacement = file_get_contents(dirname(__FILE__) . '/metrika-script.html');
ensure(strpos($replacement, "'iconamaster:pageview'") !== false, 'Missing pageview listener');
ensure(strpos($replacement, 'defer:true') !== false, 'Missing deferred initial pageview');
function patchHtml($directory, $replacement) {
    $count = 0;
    foreach (scandir($directory) as $name) {
        if ($name === '.' || $name === '..') continue;
        $file = $directory . '/' . $name;
        if (is_link($file)) continue;
        if (is_dir($file)) { $count += patchHtml($file, $replacement); continue; }
        if (substr($name, -5) !== '.html') continue;
        $html = file_get_contents($file);
        ensure($html !== false, 'Cannot read HTML');
        if (strpos($html, 'data-metrika="112185835"') === false) continue;
        ensure(preg_match_all('/<script data-metrika="112185835">[\s\S]*?<\/script>/', $html, $matches) === 1, 'Expected one counter script');
        ensure(strpos($matches[0][0], 'var started=false;') !== false, 'Unexpected old tracking script');
        ensure(substr_count($html, '/assets/index-Dff30IsG.js') === 1, 'Unexpected old app asset');
        $patched = str_replace($matches[0][0], $replacement, $html);
        $patched = str_replace('/assets/index-Dff30IsG.js', '/assets/index-BMdMxOp0.js', $patched);
        ensure(file_put_contents($file, $patched) === strlen($patched), 'Cannot write HTML');
        $count++;
    }
    return $count;
}
$count = patchHtml($root, $replacement);
ensure($count >= 240, 'Missing static pages or live templates');
echo 'UPDATED_TRACKING_PAGES=' . $count . "\n";
