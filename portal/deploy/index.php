<?php
declare(strict_types=1);

/**
 * Fatortak marketing portal — production front controller.
 *
 * Responsibilities:
 *  - password login with a signed, HttpOnly session cookie
 *  - login rate limiting
 *  - starting and supervising the local Node portal process
 *  - reverse-proxying authenticated requests to 127.0.0.1
 *
 * The Node portal, its data and all credentials live under App_Data, which IIS
 * does not serve. This file is the only publicly reachable entry point.
 */

const PORTAL_PATH = '/portal/';
const SESSION_COOKIE = 'ft_portal';
const CSRF_COOKIE = 'ft_csrf';
const SESSION_TTL = 43200; // 12 hours
const MAX_FAILURES = 8;
const FAILURE_WINDOW = 900; // 15 minutes
const NODE_HOST = '127.0.0.1';
const NODE_PORT = 4318;

$siteRoot = dirname(__DIR__);
$appRoot = $siteRoot . DIRECTORY_SEPARATOR . 'App_Data' . DIRECTORY_SEPARATOR . 'portal-app';
$portalDir = $appRoot . DIRECTORY_SEPARATOR . 'marketing' . DIRECTORY_SEPARATOR . 'portal';
$dataDir = $appRoot . DIRECTORY_SEPARATOR . 'data';
$authFile = $appRoot . DIRECTORY_SEPARATOR . 'auth.json';
$tokenFile = $appRoot . DIRECTORY_SEPARATOR . 'node.token';
$logFile = $dataDir . DIRECTORY_SEPARATOR . 'server.log';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
header('X-Robots-Tag: noindex, nofollow');

function is_https(): bool
{
    return (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function ua_hash(): string
{
    return substr(hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 16);
}

function read_json(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $decoded = json_decode((string)file_get_contents($file), true);
    return is_array($decoded) ? $decoded : null;
}

function write_json(string $file, array $value): void
{
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $tmp = $file . '.tmp';
    file_put_contents($tmp, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
    @rename($tmp, $file);
}

function set_cookie(string $name, string $value, int $expires, bool $httpOnly = true): void
{
    setcookie($name, $value, [
        'expires' => $expires,
        'path' => PORTAL_PATH,
        'secure' => is_https(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ]);
}

function clear_cookie(string $name): void
{
    setcookie($name, '', [
        'expires' => time() - 3600,
        'path' => PORTAL_PATH,
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function session_value(array $auth): string
{
    $expires = time() + SESSION_TTL;
    $payload = $expires . '|' . ua_hash();
    $signature = hash_hmac('sha256', $payload, (string)$auth['secret']);
    return $expires . '.' . $signature;
}

function session_valid(array $auth): bool
{
    $raw = (string)($_COOKIE[SESSION_COOKIE] ?? '');
    if ($raw === '' || strpos($raw, '.') === false) {
        return false;
    }
    [$expires, $signature] = explode('.', $raw, 2);
    if (!ctype_digit($expires) || (int)$expires < time()) {
        return false;
    }
    $expected = hash_hmac('sha256', $expires . '|' . ua_hash(), (string)$auth['secret']);
    return hash_equals($expected, $signature);
}

function login_allowed(string $dataDir): bool
{
    $file = $dataDir . DIRECTORY_SEPARATOR . 'login-attempts.json';
    $data = read_json($file) ?: [];
    $key = substr(hash('sha256', client_ip()), 0, 24);
    $now = time();
    $attempts = array_values(array_filter((array)($data[$key] ?? []), static function ($at) use ($now): bool {
        return is_int($at) && $at > $now - FAILURE_WINDOW;
    }));
    return count($attempts) < MAX_FAILURES;
}

function record_failure(string $dataDir): void
{
    $file = $dataDir . DIRECTORY_SEPARATOR . 'login-attempts.json';
    $data = read_json($file) ?: [];
    $key = substr(hash('sha256', client_ip()), 0, 24);
    $now = time();
    $attempts = array_values(array_filter((array)($data[$key] ?? []), static function ($at) use ($now): bool {
        return is_int($at) && $at > $now - FAILURE_WINDOW;
    }));
    $attempts[] = $now;
    $data[$key] = $attempts;
    foreach ($data as $k => $list) {
        if (!is_array($list) || !$list) {
            unset($data[$k]);
        }
    }
    write_json($file, $data);
}

function clear_failures(string $dataDir): void
{
    $file = $dataDir . DIRECTORY_SEPARATOR . 'login-attempts.json';
    $data = read_json($file) ?: [];
    $key = substr(hash('sha256', client_ip()), 0, 24);
    unset($data[$key]);
    write_json($file, $data);
}

function node_health(): ?array
{
    $ch = curl_init('http://' . NODE_HOST . ':' . NODE_PORT . '/api/health');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 1,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_HTTPHEADER => ['Host: fatortak.rabbeh.com'],
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($body)) {
        return null;
    }
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

function wait_for_node(int $seconds = 10): bool
{
    $deadline = microtime(true) + $seconds;
    do {
        if (node_health() !== null) {
            return true;
        }
        usleep(250000);
    } while (microtime(true) < $deadline);
    return false;
}

function start_node(string $portalDir, string $dataDir, string $siteRoot, string $logFile, string $tokenFile): bool
{
    $node = 'C:\\Program Files\\nodejs\\node.exe';
    $token = trim((string)@file_get_contents($tokenFile));
    if ($token === '') {
        return false;
    }
    if (is_file($logFile) && filesize($logFile) > 5 * 1024 * 1024) {
        @rename($logFile, $logFile . '.1');
    }
    $env = getenv();
    if (!is_array($env)) {
        $env = [];
    }
    $env['PORTAL_DATA_DIR'] = $dataDir;
    $env['PORTAL_SCREENSHOTS_DIR'] = $siteRoot . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'screenshots';
    $env['PORTAL_HOST'] = NODE_HOST;
    $env['PORTAL_PORT'] = (string)NODE_PORT;
    $env['PORTAL_ADMIN_TOKEN'] = $token;
    $env['PORTAL_PUBLIC_BASE'] = '/portal/index.php';
    $env['PORTAL_AUTO_PUBLISH'] = 'true';
    $env['MARKETING_LIVE'] = 'true';
    $env['NODE_ENV'] = 'production';
    $command = '"' . $node . '" "server.mjs"';
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['file', $logFile, 'a'],
        2 => ['file', $logFile, 'a'],
    ];
    $process = @proc_open($command, $descriptors, $pipes, $portalDir, $env, ['bypass_shell' => true]);
    if (!is_resource($process)) {
        error_log('Fatortak portal: proc_open failed');
        return false;
    }
    if (isset($pipes[0]) && is_resource($pipes[0])) {
        fclose($pipes[0]);
    }
    return true;
}

function node_pid(): ?int
{
    $lines = [];
    @exec('netstat -ano -p tcp | findstr :' . NODE_PORT, $lines);
    foreach ($lines as $line) {
        if (stripos($line, 'LISTENING') === false) {
            continue;
        }
        $parts = preg_split('/\s+/', trim($line));
        $pid = (int)($parts[count($parts) - 1] ?? 0);
        if ($pid > 0) {
            return $pid;
        }
    }
    return null;
}

function ensure_node(string $portalDir, string $dataDir, string $siteRoot, string $logFile, string $tokenFile): bool
{
    if (node_health() !== null) {
        return true;
    }
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0775, true);
    }
    $lock = @fopen($dataDir . DIRECTORY_SEPARATOR . 'supervisor.lock', 'c');
    if ($lock && flock($lock, LOCK_EX)) {
        if (node_health() !== null) {
            flock($lock, LOCK_UN);
            fclose($lock);
            return true;
        }
        start_node($portalDir, $dataDir, $siteRoot, $logFile, $tokenFile);
        $ok = wait_for_node(10);
        flock($lock, LOCK_UN);
        fclose($lock);
        return $ok;
    }
    return wait_for_node(10);
}

function render_login(string $error, string $csrf, bool $throttled): void
{
    http_response_code($throttled ? 429 : ($error !== '' ? 401 : 200));
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    $safeError = htmlspecialchars($error, ENT_QUOTES, 'UTF-8');
    $safeCsrf = htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8');
    $errorBlock = $safeError !== '' ? '<p class="error">' . $safeError . '</p>' : '';
    echo <<<HTML
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>Fatortak portal · sign in</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
    background: radial-gradient(ellipse 60% 70% at 75% 0%, rgba(109,40,217,.45), transparent 60%),
                radial-gradient(ellipse 50% 60% at 10% 100%, rgba(34,211,238,.12), transparent 60%),
                #060816; color: #e2e8f0; }
  .card { width: 100%; max-width: 410px; padding: 34px 32px 30px; border: 1px solid rgba(148,163,184,.22);
    border-radius: 18px; background: rgba(10,15,34,.86); box-shadow: 0 30px 80px rgba(0,0,0,.55); backdrop-filter: blur(12px); }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-weight: 800;
    background: linear-gradient(135deg, #a78bfa, #22d3ee); color: #060816; }
  .brand strong { font-size: 15px; letter-spacing: .02em; }
  .brand span { display: block; color: #74839b; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: -.02em; }
  p.sub { margin: 0 0 24px; color: #94a3b8; font-size: 13px; line-height: 1.6; }
  label { display: block; margin: 0 0 7px; color: #a8b5c9; font-size: 12px; font-weight: 600; }
  input { width: 100%; padding: 12px 13px; margin-bottom: 16px; border: 1px solid rgba(148,163,184,.26);
    border-radius: 10px; background: rgba(2,6,23,.6); color: #f8fafc; font-size: 14px; outline: none; }
  input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,.18); }
  button { width: 100%; padding: 12px 14px; border: 0; border-radius: 10px; cursor: pointer;
    background: linear-gradient(100deg, #a78bfa, #22d3ee); color: #060816; font-size: 14px; font-weight: 800; }
  button:hover { filter: brightness(1.06); }
  .error { margin: 0 0 16px; padding: 10px 12px; border: 1px solid rgba(248,113,113,.35);
    border-radius: 9px; background: rgba(248,113,113,.1); color: #fca5a5; font-size: 12.5px; line-height: 1.5; }
  .foot { margin-top: 22px; color: #64748b; font-size: 11px; line-height: 1.6; }
  .foot code { color: #94a3b8; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="mark">F</div>
      <div><strong>Fatortak</strong><span>Marketing portal</span></div>
    </div>
    <h1>Sign in</h1>
    <p class="sub">Private review and publishing workspace. Authorised access only.</p>
    {$errorBlock}
    <form method="post" action="/portal/" autocomplete="off">
      <input type="hidden" name="csrf" value="{$safeCsrf}" />
      <label for="user">Username</label>
      <input id="user" name="user" type="text" autocomplete="username" required autofocus />
      <label for="pass">Password</label>
      <input id="pass" name="pass" type="password" autocomplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>
    <p class="foot">Session expires after 12 hours. Failed attempts are rate limited.<br />Node portal: <code>127.0.0.1:4318</code> · HTTPS only.</p>
  </main>
</body>
</html>
HTML;
}

function serve_ui(string $appRoot): void
{
    $index = $appRoot . DIRECTORY_SEPARATOR . 'marketing' . DIRECTORY_SEPARATOR . 'portal' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'index.html';
    if (!is_file($index)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');
        echo "Portal UI is missing.\n";
        return;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    readfile($index);
}

/* ------------------------------------------------------------------------- */

$auth = read_json($authFile);
if (!$auth || empty($auth['hash']) || empty($auth['secret'])) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Portal is not provisioned yet.\n";
    exit;
}

$ping = isset($_GET['ping']);
if ($ping) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $ok = ensure_node($portalDir, $dataDir, $siteRoot, $logFile, $tokenFile);
    http_response_code($ok ? 200 : 503);
    echo json_encode(['ok' => $ok, 'service' => 'fatortak-portal', 'at' => gmdate('c')], JSON_UNESCAPED_SLASHES);
    exit;
}

if (isset($_GET['logout'])) {
    clear_cookie(SESSION_COOKIE);
    header('Location: ' . PORTAL_PATH, true, 303);
    exit;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$override = strtoupper((string)($_SERVER['HTTP_X_PORTAL_METHOD'] ?? ''));
if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
    $method = $override;
}
$pathInfo = (string)($_SERVER['PATH_INFO'] ?? '');
$requestPath = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? PORTAL_PATH), PHP_URL_PATH) ?: PORTAL_PATH);
if ($requestPath === '/portal' && $pathInfo === '') {
    header('Location: ' . PORTAL_PATH, true, 301);
    exit;
}

$authenticated = session_valid($auth);

if ($method === 'POST' && isset($_POST['user'], $_POST['pass'])) {
    $csrfCookie = (string)($_COOKIE[CSRF_COOKIE] ?? '');
    $csrfPost = (string)($_POST['csrf'] ?? '');
    if ($csrfCookie === '' || $csrfPost === '' || !hash_equals($csrfCookie, $csrfPost)) {
        $csrf = bin2hex(random_bytes(24));
        set_cookie(CSRF_COOKIE, $csrf, time() + 3600);
        render_login('Your session expired. Reload the page and try again.', $csrf, false);
        exit;
    }
    if (!login_allowed($dataDir)) {
        render_login('Too many failed attempts. Try again in 15 minutes.', $csrfPost, true);
        exit;
    }
    $user = (string)$_POST['user'];
    $pass = (string)$_POST['pass'];
    $userOk = hash_equals((string)($auth['user'] ?? 'fatortak'), $user);
    $passOk = password_verify($pass, (string)$auth['hash']);
    if ($userOk && $passOk) {
        clear_failures($dataDir);
        set_cookie(SESSION_COOKIE, session_value($auth), time() + SESSION_TTL);
        clear_cookie(CSRF_COOKIE);
        header('Location: ' . PORTAL_PATH, true, 303);
        exit;
    }
    record_failure($dataDir);
    render_login('Incorrect username or password.', $csrfPost, false);
    exit;
}

if (!$authenticated) {
    if (str_starts_with($pathInfo, '/api/') || str_starts_with($pathInfo, '/media/')) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['error' => 'Session expired. Reload the page to sign in.'], JSON_UNESCAPED_SLASHES);
        exit;
    }
    $csrf = bin2hex(random_bytes(24));
    set_cookie(CSRF_COOKIE, $csrf, time() + 3600);
    render_login('', $csrf, false);
    exit;
}

if (isset($_GET['restart'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $pid = node_pid();
    if ($pid) {
        @exec('taskkill /PID ' . $pid . ' /F 2>&1');
        usleep(700000);
    }
    $ok = ensure_node($portalDir, $dataDir, $siteRoot, $logFile, $tokenFile);
    echo json_encode(['ok' => $ok, 'killed' => $pid, 'at' => gmdate('c')], JSON_UNESCAPED_SLASHES);
    exit;
}

/* Authenticated: serve the dashboard shell, then proxy the API and media. */
if ($pathInfo === '' || $pathInfo === '/') {
    serve_ui($appRoot);
    exit;
}

if (!str_starts_with($pathInfo, '/api/') && !str_starts_with($pathInfo, '/media/')) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Not found.\n";
    exit;
}

if (!ensure_node($portalDir, $dataDir, $siteRoot, $logFile, $tokenFile)) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('Retry-After: 15');
    echo '<!doctype html><meta charset="utf-8"><title>Portal starting</title>'
        . '<body style="font-family:Segoe UI,Arial,sans-serif;background:#060816;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0">'
        . '<div style="max-width:460px;padding:28px;border:1px solid #334155;border-radius:14px;background:#0a0f22">'
        . '<h1 style="font-size:18px;margin:0 0 8px">Portal is starting</h1>'
        . '<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 16px">The Node service did not answer yet. Wait a few seconds and retry.</p>'
        . '<a href="/portal/" style="color:#a78bfa;font-size:13px">Retry</a></div></body>';
    exit;
}

$nodePath = $pathInfo;
$query = (string)($_SERVER['QUERY_STRING'] ?? '');
$url = 'http://' . NODE_HOST . ':' . NODE_PORT . $nodePath . ($query !== '' ? '?' . $query : '');

$token = trim((string)@file_get_contents($tokenFile));
$headers = [
    'Host: fatortak.rabbeh.com',
    'Authorization: Bearer ' . $token,
    'X-Forwarded-Proto: https',
    'X-Forwarded-For: ' . client_ip(),
    'Accept: ' . (string)($_SERVER['HTTP_ACCEPT'] ?? '*/*'),
];
foreach (['CONTENT_TYPE' => 'Content-Type', 'HTTP_ORIGIN' => 'Origin', 'HTTP_REFERER' => 'Referer', 'HTTP_USER_AGENT' => 'User-Agent', 'HTTP_X_FILE_NAME' => 'X-File-Name', 'HTTP_X_REQUESTED_WITH' => 'X-Requested-With'] as $serverKey => $headerName) {
    if (!empty($_SERVER[$serverKey])) {
        $headers[] = $headerName . ': ' . (string)$_SERVER[$serverKey];
    }
}

$body = '';
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $body = (string)file_get_contents('php://input');
}

$responseHeaders = [];
$ch = curl_init($url);
$options = [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
        $length = strlen($line);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, 'HTTP/')) {
            return $length;
        }
        $parts = explode(':', $trimmed, 2);
        if (count($parts) === 2) {
            $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
        return $length;
    },
];
if ($method === 'HEAD') {
    $options[CURLOPT_NOBODY] = true;
} elseif ($body !== '' || in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    $options[CURLOPT_POSTFIELDS] = $body;
}
curl_setopt_array($ch, $options);
$responseBody = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($responseBody === false) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => 'Portal upstream unavailable', 'detail' => $curlError], JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code($status > 0 ? $status : 502);
foreach (['content-type', 'content-disposition', 'cache-control', 'etag', 'last-modified', 'location'] as $name) {
    if (isset($responseHeaders[$name])) {
        header($name . ': ' . $responseHeaders[$name], true);
    }
}
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
if (!isset($responseHeaders['cache-control'])) {
    header('Cache-Control: no-store');
}
if ($method !== 'HEAD') {
    header('Content-Length: ' . strlen($responseBody));
    echo $responseBody;
}
