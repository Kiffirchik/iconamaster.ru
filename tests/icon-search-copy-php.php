<?php
// Read-only gate for the actual MTW renderer (PHP 5.2 compatible).
error_reporting(E_ALL);
$root = $argv[1];
require $root.'/corona/admin/text-editor/render.php';
$bundle = ce_bundle($root);
$routes = ce_read($root.'/.live-templates/routes.json');
function snippet_expect($ok, $detail) {
    if (!$ok) { fwrite(STDERR, $detail."\n"); exit(1); }
}
function snippet_fields($html) {
    snippet_expect(preg_match('~<title\b[^>]*>([^<]+)</title>~', $html, $t), 'Missing title');
    snippet_expect(preg_match('~<meta name="description" content="([^"]+)"~', $html, $d), 'Missing description');
    snippet_expect(preg_match('~<meta property="og:title" content="([^"]+)"~', $html, $ot), 'Missing Open Graph title');
    snippet_expect(preg_match('~<meta property="og:description" content="([^"]+)"~', $html, $od), 'Missing Open Graph description');
    snippet_expect(preg_match('~<meta name="twitter:title" content="([^"]+)"~', $html, $tt), 'Missing Twitter title');
    snippet_expect(preg_match('~<meta name="twitter:description" content="([^"]+)"~', $html, $td), 'Missing Twitter description');
    snippet_expect($ot[1] === $t[1] && $od[1] === $d[1], 'Mismatched Open Graph');
    snippet_expect($tt[1] === $t[1] && $td[1] === $d[1], 'Mismatched Twitter metadata');
    $fields = array(html_entity_decode($t[1], ENT_QUOTES, 'UTF-8'), html_entity_decode($d[1], ENT_QUOTES, 'UTF-8'));
    snippet_expect(preg_match('~<script type="application/ld\+json"[^>]*>(.*?)</script>~s', $html, $ld), 'Missing JSON-LD');
    $value = json_decode($ld[1], true);
    foreach ($value['@graph'] as $node) {
        if ($node['@type'] === 'VisualArtwork' || $node['@type'] === 'Product') snippet_expect($node['description'] === $fields[1], 'Mismatched JSON-LD description');
        if ($node['@type'] === 'BreadcrumbList') snippet_expect($node['itemListElement'][1]['name'] === $fields[0], 'Mismatched breadcrumb title');
    }
    return $fields;
}
$titles = array(); $descriptions = array(); $count = 0;
foreach ($bundle['icons'] as $index => $icon) {
    if (!ce_icon_visible($icon)) continue;
    $route = '/icons/'.$icon['slug'];
    snippet_expect(isset($routes[$route]), 'Missing route '.$route);
    $template = file_get_contents($root.'/.live-templates/'.$routes[$route]);
    list($title, $description) = snippet_fields(ce_render($template, $route, $bundle));
    $static = file_get_contents($root.$route.'/index.html');
    snippet_expect(snippet_fields($static) === array($title, $description), 'Static/PHP snippet divergence: '.$route);
    snippet_expect(!isset($titles[$title]), 'Duplicate title: '.$route);
    snippet_expect(!isset($descriptions[$description]), 'Duplicate description: '.$route);
    $titles[$title] = $descriptions[$description] = true;
    $count++;
    if ($icon['slug'] === 'ikona-bogorodity-utoli-moi-pecali-copy') {
        snippet_expect(strpos($title, 'на светло-зелёном фоне') !== false, 'Missing photo-based title');
        $edited = $bundle;
        $edited['icons'][$index]['description'] = 'Уточнённое мастерской описание образа.';
        list($liveTitle, $liveDescription) = snippet_fields(ce_render($template, $route, $edited));
        snippet_expect($liveTitle === $title && $liveDescription === 'Уточнённое мастерской описание образа.', 'New live description must win');
    }
    if ($icon['slug'] === 'ikona-spas-nerukotvornyi-1') {
        $edited = $bundle;
        $edited['icons'][$index]['size'] = '61 × 51 см';
        list($liveTitle) = snippet_fields(ce_render($template, $route, $edited));
        snippet_expect(strpos($title, '60 × 50 см') !== false && strpos($liveTitle, '60 × 50 см') === false, 'Stale size must not be asserted');
    }
    if ($icon['slug'] === 'gospod-vsederzhitel-kiot') {
        snippet_expect(strpos($description, 'масло и сусальное золото') !== false, 'Missing verified description');
        $edited = $bundle;
        $edited['icons'][$index]['description'] = str_replace('масло', 'яичная темпера', $icon['description']);
        list($updatedTitle, $updatedDescription) = snippet_fields(ce_render($template, $route, $edited));
        snippet_expect(strpos($updatedDescription, 'масло') === false, 'Corrected technique must override the prepared description');
    }
    if ($icon['slug'] === 'ikona-bogorodity-kazanskay-3') {
        snippet_expect(substr($description, -strlen('золотым…')) === 'золотым…', '160-character word boundary must agree with React');
    }
}
snippet_expect($count > 0, 'Missing catalogue');
echo 'PASS distinct PHP metadata for '.$count." published icon routes\n";
