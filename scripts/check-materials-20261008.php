<?php
// Read-only PHP 5.2 publication gate: introduction only, original history intact.
error_reporting(E_ALL);
$root = $argv[1];
$live = $argv[2];
$old = json_decode(file_get_contents($live.'/content/articles.json'), true);
$new = json_decode(file_get_contents($root.'/content/articles.json'), true);
$found = false;
foreach ($new as $index => $article) {
    if ($article['slug'] !== 'icon-painting-pigments') continue;
    if ($found) throw new Exception('Duplicate pigments article');
    $found = true;
    $intro = array_shift($new[$index]['sections']);
    if ($intro['heading'] !== 'Минеральные краски в нашей мастерской' || count($intro['paragraphs']) !== 2) throw new Exception('Missing approved introduction');
}
if (!$found || $new !== $old) throw new Exception('Unapproved article changes');
require $root.'/corona/admin/text-editor/render.php';
$routes = json_decode(file_get_contents($root.'/.live-templates/routes.json'), true);
$bundle = ce_bundle($root);
foreach (array('/' => 'Рукописные иконы Московской мастерской', '/articles/icon-painting-pigments' => 'Минеральные краски в нашей мастерской') as $route => $text) {
    $html = ce_render(file_get_contents($root.'/.live-templates/'.$routes[$route]), $route, $bundle);
    if (!is_string($html) || strpos($html, '<!--LIVE:') !== false || strpos($html, '<!--VISIBLE:') !== false || strpos($html, $text) === false) throw new Exception('Incorrect rendered copy: '.$route);
    if ($route === '/' && strpos($html, 'Как мы готовим краски для икон') === false) throw new Exception('Missing article link');
    echo 'OK approved materials '.$route."\n";
}
