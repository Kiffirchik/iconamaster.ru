<?php
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$root = dirname(__FILE__);
require $root.'/corona/admin/text-editor/render.php';
try {
    $route = isset($_GET['route']) && is_string($_GET['route']) ? $_GET['route'] : '/';
    $routes = ce_read($root.'/.live-templates/routes.json');
    if (!isset($routes[$route])) { ce_status(404); readfile($root.'/404.html'); exit; }
    $bundle = ce_bundle($root);
    if (!ce_route_visible($route, $bundle)) {
        ce_status(404);
        header('X-Robots-Tag: noindex');
        echo ce_render(file_get_contents($root.'/404.html'), '/404', $bundle);
        exit;
    }
    $template = file_get_contents($root.'/.live-templates/'.$routes[$route]);
    if ($template === false) throw new RuntimeException('Missing page template.');
    echo ce_render($template, $route, $bundle);
} catch (Exception $ex) {
    error_log('Content renderer: '.$ex->getMessage());
    ce_status(503);
    header('Retry-After: 60');
    echo '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Мастерская</title><p>Страница временно недоступна. Пожалуйста, обновите её через минуту.</p></html>';
}
