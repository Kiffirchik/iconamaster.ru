<?php
// Read-only checks against a private extracted build on the actual hosting runtime.
$root = $argv[1];
require $root.'/corona/admin/text-editor/render.php';
$bundle = ce_bundle($root);
$row = $bundle['icons'][0];
foreach (array('В наличии', 'Продано', 'По запросу', '') as $status) {
    $row['availability'] = $status;
    $html = ce_slot('icon-detail', $row);
    $expected = $status === '' ? 'Наличие уточняется' : $status;
    if (strpos($html, '<p class="icon-detail-page__availability">'.$expected.'</p>') === false) throw new RuntimeException('Availability mismatch');
}
$row['description'] = '<script>test</script>';
if (ce_slot('icon-description', $row) !== '<p class="icon-detail-page__description">&lt;script&gt;test&lt;/script&gt;</p>') throw new RuntimeException('Description escaping mismatch');
echo "PASS four availability states and escaped live description\n";
