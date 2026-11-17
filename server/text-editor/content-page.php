<?php
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$root = dirname(__FILE__);
require $root.'/corona/admin/text-editor/render.php';
try {
    $route = isset($_GET['route']) && is_string($_GET['route']) ? $_GET['route'] : '/';
    $routes = ce_read($root.'/.live-templates/routes.json');
    if (isset($_GET['icon_alias']) && $_GET['icon_alias'] === '1') {
        // Apache replaces the query with the dispatch flag. Use the original
        // URL to resolve the alias and keep campaign parameters on the 301.
        $request = explode('?', $_SERVER['REQUEST_URI'], 2);
        $aliases = ce_read($root.'/content/aliases.json');
        $aliasTarget = ce_text($aliases, rawurldecode($request[0]));
        if (preg_match('~^/icons/[a-z0-9-]+$~D', $aliasTarget) && isset($routes[$aliasTarget])
            && ce_route_visible($aliasTarget, array('icons'=>ce_read($root.'/content/icons.json')))) {
            $query = isset($request[1]) && $request[1] !== '' && !preg_match('/[\x00-\x20\x7f]/', $request[1]) ? '?'.$request[1] : '';
            header('Location: https://iconamaster.ru'.$aliasTarget.$query, true, 301);
            exit;
        }
        ce_status(404);
        header('X-Robots-Tag: noindex');
        readfile($root.'/404.html');
        exit;
    }
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
