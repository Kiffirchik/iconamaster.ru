<?php
// CLI create-only migration on a private stage; never updates an existing icon.
if(PHP_SAPI!=='cli' || !isset($argv[1],$argv[2]))throw new RuntimeException('CLI stage and additions required');
$root=realpath($argv[1]);
if(!$root || (strpos(basename($root),'iconamaster.ru.stage-new-icons-')!==0 && strpos(basename($root),'editor-test-')!==0))throw new RuntimeException('Private stage required');
$file=$root.'/content/icons.json';$before=json_decode(file_get_contents($file),true);$added=json_decode(file_get_contents($argv[2]),true);
if(!is_array($before)||!count($before)||!is_array($added)||count($added)!==1)throw new RuntimeException('Invalid collections');
$row=$added[0];
if($row['slug']!=='venchalnaya-para-vsederzhitel-kazanskaya'||$row['price']!=='120 000 руб.'||$row['discount']!==50||$row['newPrice']!==58000||$row['purpose']!=='Венчальная'||count($row['images'])!==2)throw new RuntimeException('Unexpected addition');
$routes=json_decode(file_get_contents($root.'/.live-templates/routes.json'),true);
$images=array();
foreach($before as $existing){
 if($existing['slug']===$row['slug']||$existing['id']===$row['id']||$existing['title']===$row['title'])throw new RuntimeException('Existing card collision');
 if(!isset($routes['/icons/'.$existing['slug']]))throw new RuntimeException('Missing existing restore route');
 foreach($existing['images'] as $image)$images[$image['src']]=true;
}
if(!isset($routes['/icons/'.$row['slug']]))throw new RuntimeException('Missing new route');
foreach($row['images'] as $image){
 if(isset($images[$image['src']])||!preg_match('#^/assets/icons/[a-z0-9-]+\.jpg$#',$image['src'])||!is_file($root.$image['src']))throw new RuntimeException('Missing or duplicate photo');
 $images[$image['src']]=true;
}
$rows=array_merge($added,$before);if(array_slice($rows,1)!==$before)throw new RuntimeException('Existing data changed');
$json=json_encode($rows);if($json===false||json_decode($json,true)!==$rows)throw new RuntimeException('JSON round-trip failed');
$temp=tempnam($root.'/content','.wedding-');
if(!$temp||file_put_contents($temp,$json."\n")!==strlen($json)+1)throw new RuntimeException('Write failed');
chmod($temp,0644);if(!rename($temp,$file))throw new RuntimeException('Atomic replace failed');
echo 'Added wedding pair; preserved '.count($before)." existing records\n";
