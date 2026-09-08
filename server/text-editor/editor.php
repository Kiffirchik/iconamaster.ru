<?php
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
session_start();
if (!isset($_SESSION['ADMINUS']) || $_SESSION['ADMINUS'] !== 'ok') {
    if (isset($_GET['kind'], $_GET['slug']) && is_string($_GET['kind']) && is_string($_GET['slug']) && in_array($_GET['kind'], array('icons','articles'), true) && preg_match('/^[a-z0-9-]+$/D', $_GET['slug'])) {
        $_SESSION['content_return'] = '/corona/admin/content.php?kind='.$_GET['kind'].'&slug='.$_GET['slug'];
    }
    header('Location: /corona/admin/login.php');
    exit;
}
require dirname(__FILE__).'/store.php';
if (isset($_SESSION['content_return'])) {
    $return = $_SESSION['content_return']; unset($_SESSION['content_return']);
    if (!isset($_GET['slug']) && is_string($return) && preg_match('~^/corona/admin/content\.php\?kind=(icons|articles)&slug=[a-z0-9-]+$~D', $return)) { header('Location: '.$return); exit; }
}
function e($value) { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
function editor_url($kind, $slug = '') { return '/corona/admin/content.php?kind='.rawurlencode($kind).($slug !== '' ? '&slug='.rawurlencode($slug) : ''); }
$root = dirname(dirname(dirname(dirname(__FILE__))));
$kind = isset($_GET['kind']) && is_string($_GET['kind']) ? $_GET['kind'] : 'icons';
$slug = isset($_GET['slug']) && is_string($_GET['slug']) ? $_GET['slug'] : '';
$query = isset($_GET['q']) && is_string($_GET['q']) ? trim($_GET['q']) : '';
$error = '';
$record = null;
$rows = array();
if (empty($_SESSION['content_csrf'])) $_SESSION['content_csrf'] = bin2hex(ce_random(32));
$errorStatus = 400;
try {
    ce_collection($kind);
    $rows = ce_read($root.'/content/'.$kind.'.json');
    if ($slug !== '') $record = $rows[ce_find($rows, $slug)];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!$record || !isset($_POST['csrf']) || !ce_equal($_SESSION['content_csrf'], $_POST['csrf'])) {
            $errorStatus = 403;
            throw new RuntimeException('Сессия формы устарела. Обновите страницу и повторите сохранение.');
        }
        ce_save($root, $kind, $slug, isset($_POST['revision']) ? $_POST['revision'] : '', isset($_POST['fields']) ? $_POST['fields'] : null);
        $_SESSION['content_saved'] = $kind.':'.$slug;
        header('Location: '.editor_url($kind, $slug), true, 303);
        exit;
    }
} catch (Exception $ex) { $error = $ex->getMessage(); ce_status($errorStatus); }
$saved = isset($_SESSION['content_saved']) && $_SESSION['content_saved'] === $kind.':'.$slug;
unset($_SESSION['content_saved']);
?>
<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Редактор — Московская иконописная мастерская</title><link rel="stylesheet" href="/corona/admin/text-editor/editor.css"></head><body>
<header class="bar"><a class="brand" href="<?=e(editor_url('icons'))?>">Мастерская · Редактор</a><a href="/" target="_blank" rel="noopener">Открыть сайт ↗</a></header>
<main><nav class="tabs" aria-label="Разделы редактора"><a <?= $kind === 'icons' ? 'aria-current="page"' : '' ?> href="<?=e(editor_url('icons'))?>">Карточки икон</a><a <?= $kind === 'articles' ? 'aria-current="page"' : '' ?> href="<?=e(editor_url('articles'))?>">Статьи</a></nav>
<?php if ($error): ?><div class="error" role="alert"><?=e($error)?></div><?php endif; ?>
<?php if ($record): ?>
<a href="<?=e(editor_url($kind))?>">← К списку</a><h1><?=e($record['title'])?></h1>
<?php if ($saved && !$error): ?><div class="success" role="status">Сохранено. Изменения уже на сайте.</div><?php endif; ?>
<p><a href="/<?=e($kind)?>/<?=e(rawurlencode($slug))?>" target="_blank" rel="noopener">Открыть эту страницу на сайте ↗</a></p>
<form method="post" action="<?=e(editor_url($kind, $slug))?>">
<input type="hidden" name="csrf" value="<?=e($_SESSION['content_csrf'])?>"><input type="hidden" name="revision" value="<?=e(isset($_POST['revision']) && is_string($_POST['revision']) ? $_POST['revision'] : ce_revision($record))?>">
<?php foreach (ce_fields($kind, $record) as $key=>$field): $value = isset($_POST['fields'][$key]) && is_string($_POST['fields'][$key]) ? $_POST['fields'][$key] : $field[2]; ?>
<label class="field" for="<?=e($key)?>"><span><?=e($field[0])?></span>
<?php if ($field[1] === 'text'): ?><input id="<?=e($key)?>" name="fields[<?=e($key)?>]" value="<?=e($value)?>" <?= $key === 'title' ? 'required' : '' ?>>
<?php else: ?><textarea id="<?=e($key)?>" name="fields[<?=e($key)?>]" rows="<?=$field[1] === 'paragraphs' ? 14 : 5?>"><?=e($value)?></textarea><?php endif; ?>
<?php if ($field[1] === 'paragraphs'): ?><small>Разделяйте абзацы пустой строкой. Изображения между блоками сохраняются.</small><?php endif; ?>
</label><?php endforeach; ?>
<div class="save"><button type="submit">Сохранить</button><span>Изменения появятся на сайте сразу после сохранения.</span></div></form>
<?php elseif (!$error): ?><h1><?=$kind === 'icons' ? 'Карточки икон' : 'Статьи'?></h1>
<form class="search" method="get"><input type="hidden" name="kind" value="<?=e($kind)?>"><label for="q">Найти по названию</label><div><input id="q" name="q" value="<?=e($query)?>"><button>Найти</button></div></form>
<ul class="records"><?php $count=0; foreach ($rows as $row): if ($query !== '' && mb_stripos($row['title'].' '.$row['slug'], $query, 0, 'UTF-8') === false) continue; $count++; ?>
<li><div><a href="<?=e(editor_url($kind, $row['slug']))?>"><?=e($row['title'])?></a><small><?=e(isset($row['price']) ? $row['price'] : '')?> · <?=e($row['slug'])?></small></div><a class="edit" href="<?=e(editor_url($kind, $row['slug']))?>">Редактировать</a></li><?php endforeach; ?></ul>
<p class="muted"><?=$count?> записей</p><?php endif; ?></main></body></html>
