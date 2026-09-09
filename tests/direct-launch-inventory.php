<?php
// Read-only: prove that the requested availability update is the only content change.
$before = json_decode(file_get_contents($argv[1].'/content/icons.json'), true);
$after = json_decode(file_get_contents($argv[2].'/content/icons.json'), true);
if (!is_array($before) || !is_array($after) || count($before) !== 95 || count($after) !== 95) throw new RuntimeException('Invalid inventory');
$changed = 0;
foreach ($before as $i => $row) {
    if (!isset($row['availability']) || trim($row['availability']) === '') {
        $row['availability'] = 'В наличии';
        $changed++;
    }
    if ($row !== $after[$i]) throw new RuntimeException('Unrequested change: '.$row['slug']);
}
if ($changed !== 85) throw new RuntimeException('Unexpected changed count');
echo "PASS exactly 85 empty statuses updated; all other icon fields preserved\n";
