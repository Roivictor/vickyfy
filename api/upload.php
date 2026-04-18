<?php
// Activer l'affichage des erreurs pour debug
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Content-Type: application/json');

require_once 'config.php';

// Pour debug - afficher ce qui est reçu
error_log("=== UPLOAD REQUEST RECEIVED ===");
error_log("POST data: " . print_r($_POST, true));
error_log("FILES data: " . print_r($_FILES, true));

// Vérifier si c'est une requête POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Vérifier les champs requis
if (empty($_POST['title']) || empty($_POST['artist'])) {
    echo json_encode(['error' => 'Title and artist are required']);
    exit;
}

if (!isset($_FILES['song']) || $_FILES['song']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['error' => 'No file uploaded or upload error']);
    exit;
}

$title = htmlspecialchars($_POST['title']);
$artist = htmlspecialchars($_POST['artist']);
$file = $_FILES['song'];

// Vérifier le type de fichier
$allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav'];
if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['error' => 'Invalid file type. Only MP3, WAV allowed']);
    exit;
}

// Créer le dossier uploads s'il n'existe pas
$uploadDir = __DIR__ . '/../uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
    error_log("Created uploads directory at: " . $uploadDir);
}

// Générer un nom unique pour le fichier
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = time() . '_' . uniqid() . '.' . $extension;
$uploadPath = $uploadDir . $filename;

error_log("Saving file to: " . $uploadPath);

// Déplacer le fichier
if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
    error_log("File moved successfully");
    
    // Insérer dans la base de données
    try {
        $stmt = $pdo->prepare("INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)");
        $result = $stmt->execute([$title, $artist, $filename]);
        
        if ($result) {
            $songId = $pdo->lastInsertId();
            error_log("Song inserted with ID: " . $songId);
            echo json_encode([
                'success' => true, 
                'id' => $songId,
                'message' => 'Song uploaded successfully'
            ]);
        } else {
            echo json_encode(['error' => 'Failed to insert into database']);
        }
    } catch (PDOException $e) {
        error_log("Database error: " . $e->getMessage());
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
} else {
    error_log("Failed to move uploaded file");
    echo json_encode(['error' => 'Failed to save file']);
}
?>