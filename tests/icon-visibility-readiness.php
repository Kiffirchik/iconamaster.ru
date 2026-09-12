<?php
// Read-only release gate: even hidden live icons must retain restore templates.
$root=$argv[1];
require $root.'/corona/admin/text-editor/render.php';
$routes=ce_read($root.'/.live-templates/routes.json');
$collection=file_get_contents($root.'/.live-templates/'.$routes['/collection']);
$sitemap=file_get_contents($root.'/sitemap.xml');
foreach(ce_read($root.'/content/icons.json') as $row){
    $route='/icons/'.$row['slug'];
    if(!isset($routes[$route]) || !is_file($root.'/.live-templates/'.$routes[$route]) || strpos($collection,'<!--VISIBLE:'.$row['slug'].'-->')===false || strpos($sitemap,$route.'</loc>')===false) throw new RuntimeException('Missing restore artifacts: '.$row['slug']);
}
echo "PASS all live icons retain restore routes, cards and sitemap entries\n";
