<?php
// Test-only router: bind php -S to 127.0.0.1 and use a private editor-test-* docroot.
if (strpos(basename(getcwd()), 'editor-test-') !== 0) die('Private test root required');
if ($_SERVER['REMOTE_ADDR'] !== '127.0.0.1') { header('HTTP/1.1 403 Forbidden'); exit; }
if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/test-session') {
    session_start(); $_SESSION['ADMINUS']='ok'; echo 'Test session'; return true;
}
return false;
