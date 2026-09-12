<?php
if(PHP_SAPI!=='cli'||!isset($argv[1]))die('CLI required');
$base=realpath($argv[1]);if($base!=='/www/vhosts/27769')throw new RuntimeException('Private host test required');
$root=$base.'/editor-test-wedding-'.uniqid();
mkdir($root);mkdir($root.'/content');mkdir($root.'/.live-templates');mkdir($root.'/assets');mkdir($root.'/assets/icons');
$before=json_decode(file_get_contents($base.'/iconamaster.ru/content/icons.json'),true);
$new=json_decode(file_get_contents($base.'/wedding-pair-20260912.json'),true);
$routes=array();foreach(array_merge($before,$new) as $row)$routes['/icons/'.$row['slug']]='test.html';
foreach($new as $row)foreach($row['images'] as $image)touch($root.$image['src']);
file_put_contents($root.'/content/icons.json',json_encode($before));file_put_contents($root.'/.live-templates/routes.json',json_encode($routes));
$expectedBefore=$before;$argv=array('append',$root,$base.'/wedding-pair-20260912.json');
include $base.'/append-wedding-pair-20260912.php';
$after=json_decode(file_get_contents($root.'/content/icons.json'),true);
if(count($after)!==count($expectedBefore)+1||array_slice($after,1)!==$expectedBefore||array_slice($after,0,1)!==$new)throw new RuntimeException('Data preservation failed');
$hash=sha1_file($root.'/content/icons.json');$rejected=false;
try{include $base.'/append-wedding-pair-20260912.php';}catch(Exception $ex){$rejected=$ex->getMessage()==='Existing card collision';}
if(!$rejected||sha1_file($root.'/content/icons.json')!==$hash)throw new RuntimeException('Collision did not fail safely');
echo "PASS exact addition, all prior fields and publication flags preserved, duplicate rejected without writes\n";
