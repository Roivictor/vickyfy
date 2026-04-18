<?php
// Activer les erreurs pour debug
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Content-Type: audio/mpeg');

require_once 'config.php';

if (!isset($_GET['id'])) {
    http_response_code(400);
    die('No song ID');
}

$id = intval($_GET['id']);
error_log("Getting song ID: " . $id);

// Récupérer le nom du fichier
$stmt = $pdo->prepare("SELECT filename, title, artist FROM songs WHERE id = ?");
$stmt->execute([$id]);
$song = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$song) {
    http_response_code(404);
    die('Song not found in database');
}

error_log("Looking for file: " . $song['filename']);

$filePath = __DIR__ . '/../uploads/' . $song['filename'];

if (!file_exists($filePath)) {
    http_response_code(404);
    error_log("File not found at: " . $filePath);
    die('File not found on server');
}

// Envoyer le fichier
header('Content-Length: ' . filesize($filePath));
header('Content-Disposition: inline; filename="' . $song['filename'] . '"');
readfile($filePath);
?>