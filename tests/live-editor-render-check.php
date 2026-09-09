<?php
// Read-only preflight. Check initial PHP markup against the verified React snapshot.
$root=$argv[1]; require $root.'/corona/admin/text-editor/render.php';
$bundle=ce_bundle($root); $map=ce_read($root.'/.live-templates/routes.json');
function normalized_main($html) {
    // PHP 5.2's default PCRE backtrack limit is smaller than a full catalog page.
    $start = strpos($html, '<main ');
    $end = $start === false ? false : strpos($html, '</main>', $start);
    if ($start === false || $end === false) throw new RuntimeException('Missing main');
    $main = substr($html, $start, $end - $start + 7);
    return str_replace('&#039;','&#x27;',preg_replace('~<!--.*?-->~s','',$main));
}
$count=0;
foreach($map as $route=>$file) {
    $actual=ce_render(file_get_contents($root.'/.live-templates/'.$file),$route,$bundle);
    $static=file_get_contents($root.($route==='/' ? '' : $route).'/index.html');
    if(normalized_main($actual)!==normalized_main($static)) {
        $a=normalized_main($actual); $b=normalized_main($static); $i=0;
        while($i<min(strlen($a),strlen($b)) && $a[$i]===$b[$i]) $i++;
        throw new RuntimeException('Markup mismatch '.$route.' near '.substr($a,max(0,$i-50),180).' EXPECTED '.substr($b,max(0,$i-50),180));
    }
    $count++;
}
echo 'PASS PHP/React markup parity for '.$count." routes\n";
