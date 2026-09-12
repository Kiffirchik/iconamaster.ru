<?php
// CLI only. Add new cards on a private stage, preserving every live record.
if (PHP_SAPI !== 'cli' || !isset($argv[1]) || !isset($argv[2])) throw new RuntimeException('CLI stage and additions required');
$root=realpath($argv[1]);
if (!$root || (strpos(basename($root),'iconamaster.ru.stage-new-icons-')!==0 && strpos(basename($root),'editor-test-')!==0)) throw new RuntimeException('Private stage required');
$file=$root.'/content/icons.json';
$before=json_decode(file_get_contents($file),true);
$added=json_decode(file_get_contents($argv[2]),true);
if (!is_array($before) || !count($before) || !is_array($added) || count($added)!==3) throw new RuntimeException('Invalid collections');
$routes=json_decode(file_get_contents($root.'/.live-templates/routes.json'),true);
$slugs=array(); $ids=array(); $images=array();
foreach ($before as $row) {
    $slugs[$row['slug']]=true; $ids[$row['id']]=true;
    if ($row['published'] && !isset($routes['/icons/'.$row['slug']])) throw new RuntimeException('Missing existing live route');
    foreach ($row['images'] as $image) $images[$image['src']]=true;
}
foreach ($added as $row) {
    if (isset($slugs[$row['slug']]) || isset($ids[$row['id']])) throw new RuntimeException('Existing card collision');
    $slugs[$row['slug']]=true; $ids[$row['id']]=true;
    if (!isset($routes['/icons/'.$row['slug']])) throw new RuntimeException('Missing new live route');
    foreach ($row['images'] as $image) {
        if (isset($images[$image['src']]) || !preg_match('#^/assets/icons/[a-z0-9-]+\.jpg$#',$image['src']) || !is_file($root.$image['src'])) throw new RuntimeException('Missing or duplicate photo');
        $images[$image['src']]=true;
    }
}
$rows=array_merge($added,$before);
if (array_slice($rows,3)!==$before) throw new RuntimeException('Existing data changed');
$json=json_encode($rows);
if ($json===false || json_decode($json,true)!==$rows) throw new RuntimeException('JSON round-trip failed');
$temp=tempnam($root.'/content','.new-icons-');
if (!$temp || file_put_contents($temp,$json."\n")!==strlen($json)+1) throw new RuntimeException('Write failed');
chmod($temp,0644);
if (!rename($temp,$file)) throw new RuntimeException('Atomic replace failed');
echo 'Added 3 icons; preserved '.count($before)." existing records\n";
