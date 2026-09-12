<?php
// CLI regression test, only writes beneath a unique private test folder.
if (PHP_SAPI!=='cli' || !isset($argv[1])) die('CLI required');
$base=realpath($argv[1]);
if ($base!=='/www/vhosts/27769') throw new RuntimeException('Private host test directory required');
$root=$base.'/editor-test-new-icons-'.uniqid();
mkdir($root); mkdir($root.'/content'); mkdir($root.'/.live-templates'); mkdir($root.'/assets'); mkdir($root.'/assets/icons');
$before=json_decode(file_get_contents($base.'/iconamaster.ru/content/icons.json'),true);
$new=json_decode(file_get_contents($base.'/new-icons-20260912.json'),true);
$routes=array();
foreach(array_merge($before,$new) as $row) $routes['/icons/'.$row['slug']]='test.html';
foreach($new as $row) foreach($row['images'] as $image) touch($root.$image['src']);
file_put_contents($root.'/content/icons.json',json_encode($before));
file_put_contents($root.'/.live-templates/routes.json',json_encode($routes));
$expectedBefore=$before;
$argv=array('append', $root, $base.'/new-icons-20260912.json');
include $base.'/append-new-icons-20260912.php';
$after=json_decode(file_get_contents($root.'/content/icons.json'),true);
if(count($after)!==count($expectedBefore)+3 || array_slice($after,3)!==$expectedBefore || array_slice($after,0,3)!==$new) throw new RuntimeException('Data preservation failed');
$hash=sha1_file($root.'/content/icons.json');
$rejected=false;
try { include $base.'/append-new-icons-20260912.php'; } catch (Exception $exception) { $rejected=$exception->getMessage()==='Existing card collision'; }
if(!$rejected || sha1_file($root.'/content/icons.json')!==$hash) throw new RuntimeException('Collision did not fail safely');
echo 'PASS: append, preserved all fields, exact additions, duplicate rejection without writes. Test root: '.$root."\n";
