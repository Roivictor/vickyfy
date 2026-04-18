<?php
require_once 'config.php';

$search = isset($_GET['q']) ? '%' . $_GET['q'] . '%' : '';

$stmt = $pdo->prepare("
    SELECT id, title, artist, filename, plays 
    FROM songs 
    WHERE title LIKE ? OR artist LIKE ?
    ORDER BY plays DESC
");
$stmt->execute([$search, $search]);

$songs = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($songs);
?>