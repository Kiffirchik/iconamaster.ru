<?php
// Read-only preflight with the same PHP renderer used in production.
error_reporting(E_ALL);
$root = $argv[1];
require $root.'/corona/admin/text-editor/render.php';
$routes = json_decode(file_get_contents($root.'/.live-templates/routes.json'), true);
$bundle = ce_bundle($root);
foreach (array('/' => 90, '/collection' => 97) as $route => $expected) {
    $html = ce_render(file_get_contents($root.'/.live-templates/'.$routes[$route]), $route, $bundle);
    if (!is_string($html) || strpos($html, '<!--LIVE:') !== false || strpos($html, '<!--VISIBLE:') !== false) throw new Exception('Unresolved template: '.$route);
    if (substr_count($html, 'class="icon-card"') !== $expected) throw new Exception('Unexpected card count: '.$route);
    if (strpos($html, 'Образ / святой') === false) throw new Exception('Missing subject filter: '.$route);
    if (strpos($html, 'id="live-content"') === false) throw new Exception('Missing live content snapshot: '.$route);
    if ($route === '/' && (strpos($html, 'Каталог мастерской') === false || strpos($html, 'blessing-2007.jpeg') === false || strpos($html, 'Семейная мастерская') === false)) throw new Exception('Missing approved homepage sections');
    echo 'OK '.$route.' cards='.$expected."\n";
}
