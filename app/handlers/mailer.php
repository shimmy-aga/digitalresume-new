<?php
declare(strict_types=1);

mb_internal_encoding('UTF-8');
header('Content-Type: application/json; charset=UTF-8');

/**
 * Load config (shared with JS)
 * Adjust path if your structure differs.
 */
$CONFIG_PATH = __DIR__ . '/../config/mailer.config.json';
if (!is_file($CONFIG_PATH)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => 'Server config missing.']);
  exit;
}
$CFG = json_decode((string)file_get_contents($CONFIG_PATH), true);
if (!is_array($CFG)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => 'Invalid server config.']);
  exit;
}

/** Helpers */
function deep_mkdir(string $p): void { if (!is_dir($p)) @mkdir($p, 0700, true); }
function sanitize_header(string $v): string { return trim(preg_replace("/[\r\n]+/", ' ', $v)); }
function sanitize_html(string $html): string {
  $allowed = '<i><b><strong><em><h1><h2><h3><p><br>';
  $html = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', '', $html);
  $html = preg_replace('/ on\w+="[^"]*"/i', '', $html);
  $html = preg_replace("/ on\w+='[^']*'/i", '', $html);
  return strip_tags($html, $allowed);
}
function required(string $v): bool { return (bool)preg_match('/\S/u', $v); }
/** Convert a JS-style regex pattern (no delimiters) + flags into a PHP /.../flags */
function js_regex_to_php(?string $pattern, string $flags = ''): ?string {
  if (!$pattern || !is_string($pattern)) return null;

  // Case 1: If the JSON accidentally contains delimiters already, e.g. "/.../i"
  if (preg_match('/^\\/(.*)\\/([a-z]*)$/i', $pattern, $m)) {
    $body  = $m[1];
    $pflag = $m[2];
    return '/' . $body . '/' . ($pflag !== '' ? $pflag : $flags);
  }

  // Case 2: Normal JSON pattern with escaped slashes (\ /) – just wrap it as-is.
  // DO NOT str_replace('/', '\/', ...) here; it double-escapes and breaks the pattern.
  return '/' . $pattern . '/' . $flags;
}

/** Guard: POST only */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'message' => 'Method not allowed.']);
  exit;
}

/** Extract config fields (from JSON) */
$validation = $CFG['validation'] ?? [];
$messages   = $CFG['messages']   ?? [];
$limits     = $CFG['limits']     ?? [];
$mailCfg    = $CFG['mail']       ?? [];

/** Compile regexes from JSON */
$emailRegex = js_regex_to_php($validation['emailRegex'] ?? null, $validation['emailRegexFlags'] ?? '');
$phoneRegex = js_regex_to_php($validation['phoneRegex'] ?? null, $validation['phoneRegexFlags'] ?? '');
$urlRegex   = js_regex_to_php($validation['urlRegex']   ?? null, $validation['urlRegexFlags']   ?? 'i');

$minLen        = isset($validation['minMessageLength']) ? (int)$validation['minMessageLength'] : 10;
$requirePhone  = !empty($validation['requirePhone']);
$blockUrls     = !empty($validation['blockUrls']);

/** Simple per-IP rate limit: N/hour (from JSON) */
$perHour = isset($limits['rateLimitPerHour']) ? (int)$limits['rateLimitPerHour'] : 5;
$rateStore = $limits['rateStore'] ?? (sys_get_temp_dir() . '/cf_rate_limit');

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
deep_mkdir($rateStore);
$bucketFile = rtrim($rateStore, '/\\') . '/bucket_' . preg_replace('/[^a-z0-9\.\-:]/i', '_', $ip);

$now = time();
$bucket = ['ts' => $now, 'hits' => 0];
if (is_file($bucketFile)) {
  $bucket = @json_decode((string)file_get_contents($bucketFile), true) ?: $bucket;
  if (($bucket['ts'] ?? 0) + 3600 < $now) $bucket = ['ts' => $now, 'hits' => 0]; // reset hourly
}
$bucket['hits'] = ($bucket['hits'] ?? 0) + 1;
@file_put_contents($bucketFile, json_encode($bucket), LOCK_EX);

if ($bucket['hits'] > $perHour) {
  http_response_code(429);
  echo json_encode(['ok' => false, 'message' => sanitize_html((string)($messages['rateHtml'] ?? 'Too many submissions. Please try again later.'))]);
  exit;
}

/** Inputs */
$name    = trim((string)($_POST['name']    ?? ''));
$email   = trim((string)($_POST['email']   ?? ''));
$phone   = trim((string)($_POST['phone']   ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

/** Validation (matches JS + JSON) */
$errors = [];

/* Name: required; allow letters/marks/space/'-. (same as earlier) */
if (!required($name)) {
  $errors['name'] = 'Name is required.';
} elseif (!preg_match('/^[\p{L}\p{M}\'\-\.\s]{2,}$/u', $name)) {
  $errors['name'] = 'Please enter a valid name.';
}

/* Email: from JSON regex */
if ($emailRegex) {
  if (!preg_match($emailRegex, $email)) {
    $errors['email'] = 'Please enter a valid email address.';
  }
} else {
  // fallback if pattern absent (rare)
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please enter a valid email address.';
  }
}

/* Phone: clean, then test JSON regex if required or provided */
$cleanPhone = preg_replace('/(?!^)\+|[^\d+]/', '', $phone);
if ($requirePhone || $phone !== '') {
  if ($phoneRegex) {
    if (!preg_match($phoneRegex, $cleanPhone ?? '')) {
      $errors['phone'] = 'Please enter a valid phone number.';
    }
  } else {
    if (!preg_match('/^\+?\d{7,15}$/', $cleanPhone ?? '')) {
      $errors['phone'] = 'Please enter a valid phone number.';
    }
  }
}

/* Message: required + min length */
if (!required($message)) {
  $errors['message'] = 'Message is required.';
} elseif (mb_strlen($message) < max(1, $minLen)) {
  $errors['message'] = "Message must be at least {$minLen} characters.";
}

/* URL blocking using JSON regex (matches JS) */
if ($blockUrls && !empty($message)) {
  $urlHit = false;
  if ($urlRegex) {
    $urlHit = (bool)preg_match($urlRegex, $message);
  } else {
    // (rare) fallback if no pattern provided
    $urlHit = (bool)preg_match('/(?:https?:\/\/|www\.)\S+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]{2,})/i', $message);
  }
  if ($urlHit) {
    $errors['message'] = ($errors['message'] ?? 'Please remove URLs from the message.');
  }
}

/** If validation failed */
if (!empty($errors)) {
  http_response_code(400);
  echo json_encode([
    'ok'      => false,
    'message' => sanitize_html((string)($messages['badRequestHtml'] ?? 'Please fix the highlighted fields and try again.')),
    'errors'  => $errors,
  ]);
  exit;
}

/** Mail composition from JSON */
$toList = $mailCfg['to'] ?? [];
if (!is_array($toList) || empty($toList)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => sanitize_html((string)($messages['failHtml'] ?? 'Send failed.'))]);
  exit;
}
$toHeaderParts = [];
$firstToEmail  = null;
foreach ($toList as $emailTo => $nameTo) {
  $toHeaderParts[] = sprintf('%s <%s>', sanitize_header((string)$nameTo), sanitize_header((string)$emailTo));
  if ($firstToEmail === null) $firstToEmail = (string)$emailTo;
}

$subject   = (string)($mailCfg['subject'] ?? 'New contact form submission');
$fromEmail = (string)($mailCfg['from']    ?? 'no-reply@example.com');
$replyTo   = $email;

/** Body */
$bodyText = implode("\n", [
  "You’ve received a new contact form submission:",
  "",
  "Name:    {$name}",
  "Email:   {$email}",
  "Phone:   {$cleanPhone}",
  "Message:",
  $message,
  "",
  "IP: " . ($_SERVER['REMOTE_ADDR'] ?? ''),
  "Time: " . date('c'),
]);

/** Headers */
$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'From: ' . sanitize_header($fromEmail);
$headers[] = 'To: ' . implode(', ', $toHeaderParts);
$headers[] = 'Reply-To: ' . sanitize_header($replyTo);

/** Send according to config */
$mailCfg = $CFG['mail'] ?? [];
$mode = strtolower((string)($mailCfg['mode'] ?? 'mail'));
$mailOk = false;

if ($mode === 'file') {
  // DEV mode: write to file
  $logRoot = $mailCfg['filePath'] ?? '/app/logs';
  // resolve /app/logs from project root relative to this file
  $logDir = dirname(__DIR__) . '/' . ltrim($logRoot, '/'); // __DIR__/.. = /app/handlers -> /app
  if (!is_dir($logDir)) { @mkdir($logDir, 0777, true); }

  $filename = $logDir . '/mailer_log_' . date('Y-m-d_H-i-s') . '.txt';
  $payload = $bodyText . "\n\nHeaders:\n" . implode("\n", $headers) . "\n";
  @file_put_contents($filename, $payload);
  $mailOk = true;

} elseif ($mode === 'smtp') {
  // SMTP via PHPMailer
  $transport = strtolower((string)($mailCfg['transport'] ?? 'smtp'));
  if ($transport !== 'smtp') { $transport = 'smtp'; }

  // composer require phpmailer/phpmailer
  require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

  try {
    $mailer = new PHPMailer\PHPMailer\PHPMailer(true);
    $mailer->isSMTP();
    $mailer->Host       = (string)($mailCfg['host'] ?? '127.0.0.1');
    $mailer->Port       = (int)($mailCfg['port'] ?? 1025);
    $mailer->SMTPAuth   = (bool)($mailCfg['auth'] ?? false);

    // secure: true | false | "tls"/"starttls"
    $secure = $mailCfg['secure'] ?? false;
    if ($secure === true || $secure === 'tls' || $secure === 'starttls') {
      $mailer->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    } else {
      $mailer->SMTPSecure = false;
    }

    if ($mailer->SMTPAuth) {
      $mailer->Username = (string)($mailCfg['username'] ?? '');
      $mailer->Password = (string)($mailCfg['password'] ?? '');
    }

    $mailer->CharSet = 'UTF-8';
    $mailer->setFrom($fromEmail);
    foreach ($toList as $emailTo => $nameTo) {
      $mailer->addAddress((string)$emailTo, (string)$nameTo);
    }
    if (!empty($replyTo)) $mailer->addReplyTo($replyTo);

    $mailer->Subject = $subject;
    $mailer->Body    = $bodyText;
    $mailer->AltBody = $bodyText;
    $mailer->isHTML(false);

    $mailOk = $mailer->send();
  } catch (Throwable $e) {
    // Optionally log $e->getMessage() to a file in /app/logs
    $mailOk = false;
  }

} else {
  // Native mail()
  $mailOk = @mail(
    sanitize_header($firstToEmail ?? $fromEmail),
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    $bodyText,
    implode("\r\n", $headers)
  );
}

/** Respond with messages from JSON */
if ($mailOk) {
  http_response_code(200);
  echo json_encode(['ok' => true, 'message' => sanitize_html((string)($messages['successHtml'] ?? 'Thanks!'))]);
} else {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => sanitize_html((string)($messages['failHtml'] ?? 'Send failed.'))]);
}

