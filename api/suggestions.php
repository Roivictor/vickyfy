<?php
require_once 'config.php';

// Suggestions aléatoires + les plus écoutées
$stmt = $pdo->query("
    (SELECT s.* FROM songs s 
     INNER JOIN suggestions sug ON s.id = sug.song_id 
     LIMIT 5)
    UNION
    (SELECT * FROM songs ORDER BY plays DESC LIMIT 5)
    LIMIT 10
");

$songs = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($songs);
?>