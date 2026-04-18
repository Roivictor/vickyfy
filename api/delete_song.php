<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
require_once 'config.php';

if (!isset($_GET['id'])) {
    echo json_encode(['error' => 'No ID']);
    exit;
}

$id = intval($_GET['id']);

// Récupérer le nom du fichier
$stmt = $pdo->prepare("SELECT filename FROM songs WHERE id = ?");
$stmt->execute([$id]);
$song = $stmt->fetch(PDO::FETCH_ASSOC);

if ($song) {
    // Supprimer le fichier
    $filePath = __DIR__ . '/../uploads/' . $song['filename'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }
    
    // Supprimer de la BD
    $stmt = $pdo->prepare("DELETE FROM songs WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['error' => 'Song not found']);
}
?>