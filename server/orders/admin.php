<?php
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
session_start();
if (!isset($_SESSION['ADMINUS']) || $_SESSION['ADMINUS']!=='ok') { header('Location: /corona/admin/login.php'); exit; }
session_write_close(); require dirname(__FILE__).'/store.php';
function oq_escape($value) { return htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8'); }
$root=dirname(dirname(dirname(dirname(__FILE__))));
$state=dirname($root).'/.iconamaster-order-requests'; $records=array(); $error=false;
$files=glob($state.'/requests/*.json');
if ($files) {
    $times=array(); foreach ($files as $file) $times[$file]=filemtime($file); arsort($times);
    foreach (array_slice(array_keys($times),0,100) as $file) { try { $records[]=oq_read($file); } catch (Exception $ex) { $error=true; } }
}
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Заявки на иконы — мастерская</title><link rel="stylesheet" href="/corona/admin/text-editor/editor.css"></head><body>
<header class="bar"><a class="brand" href="/corona/admin/content.php">Мастерская · Редактор</a><a href="/" target="_blank" rel="noopener">Открыть сайт ↗</a></header>
<main><nav class="tabs"><a href="/corona/admin/content.php?kind=icons">Карточки икон</a><a href="/corona/admin/content.php?kind=articles">Статьи</a><a aria-current="page" href="/corona/admin/orders.php">Заявки на иконы</a></nav>
<h1>Заявки на иконы</h1><p>Последние 100 заявок. Время указано по Москве. Письмо — уведомление; все полученные заявки остаются здесь.</p>
<?php if ($error): ?><p class="error">Часть заявок не удалось прочитать. Обратитесь к администратору сайта.</p><?php endif; ?>
<?php if (!$records): ?><p>Заявок пока нет.</p><?php endif; ?>
<?php foreach ($records as $record): ?><section class="visibility-panel">
<h2><?=oq_escape($record['reference'])?> · <?=oq_escape($record['icon']['title'])?></h2>
<p><?=oq_escape(gmdate('d.m.Y H:i',$record['createdAt']+10800))?> · <?=oq_escape($record['icon']['price'])?></p>
<p><strong><?=oq_escape($record['name'])?></strong><br><?=oq_escape($record['contact'])?></p>
<?php if ($record['message']!==''): ?><p><?=nl2br(oq_escape($record['message']))?></p><?php endif; ?>
<p class="<?=empty($record['notificationAcceptedAt'])?'error':'success'?>"><?=empty($record['notificationAcceptedAt'])?'Письмо не отправлено. Свяжитесь с посетителем по указанному контакту.':'Уведомление передано почтовому серверу.'?></p>
<a href="/icons/<?=oq_escape($record['icon']['slug'])?>" target="_blank" rel="noopener">Открыть икону ↗</a>
</section><?php endforeach; ?></main></body></html>
