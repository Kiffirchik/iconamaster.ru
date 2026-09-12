<?php
// CLI-only additive migration. Run on an unpublished stage while the live editor is locked.
if (PHP_SAPI !== 'cli' || !isset($argv[1])) die("CLI stage path required\n");
$root=realpath($argv[1]);
if (!$root || (strpos(basename($root),'iconamaster.ru.stage-more-details-')!==0 && strpos(basename($root),'editor-test-')!==0)) die("Private stage directory required\n");
$file=$root.'/content/icons.json';
$raw=file_get_contents($file); $rows=json_decode($raw,true);
if (!is_array($rows) || !count($rows)) throw new RuntimeException('Invalid icon collection');
$before=$rows; $added=0;
foreach($rows as $index=>$row) {
    foreach(array('moreDetails') as $key) if (!array_key_exists($key,$row)) { $rows[$index][$key]=''; $added++; }
    $check=$rows[$index];
    foreach(array('moreDetails') as $key) if (!array_key_exists($key,$before[$index])) unset($check[$key]);
    if ($check!==$before[$index]) throw new RuntimeException('Existing data changed');
}
if ($added) {
    $json=json_encode($rows);
    if ($json===false || json_decode($json,true)!==$rows) throw new RuntimeException('JSON round-trip failed');
    $temp=tempnam($root.'/content','.more-details-');
    if (!$temp || file_put_contents($temp,$json."\n")!==strlen($json)+1) throw new RuntimeException('Write failed');
    chmod($temp,0644);
    if (!rename($temp,$file)) throw new RuntimeException('Atomic replace failed');
}
echo 'Migrated '.count($rows).' icons; added '.$added." empty text fields; existing data preserved\n";
