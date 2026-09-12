<?php
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$root=dirname(__FILE__);
require $root.'/corona/admin/text-editor/render.php';
try {
    $xml=file_get_contents($root.'/sitemap.xml');
    if ($xml===false) throw new RuntimeException('Missing sitemap.');
    echo ce_visible_sitemap($xml,ce_bundle($root));
} catch (Exception $ex) {
    error_log('Content sitemap: '.$ex->getMessage());
    ce_status(503);
    header('Retry-After: 60');
}
