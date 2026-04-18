<?php
header('Access-Control-Allow-Origin: *');
require_once 'config.php';

if (!isset($_GET['id'])) {
    die('No song ID');
}

$id = intval($_GET['id']);
$stmt = $pdo->prepare("SELECT filename FROM songs WHERE id = ?");
$stmt->execute([$id]);
$song = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$song) {
    die('Song not found');
}

$filePath = __DIR__ . '/../uploads/' . $song['filename'];

if (file_exists($filePath)) {
    header('Content-Type: audio/mpeg');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
} else {
    die('File not found');
}
?>