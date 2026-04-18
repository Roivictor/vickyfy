<?php
// Configuration base de données
$host = 'localhost';
$dbname = 'vickyfy';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    error_log("Database connected successfully");
} catch(PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    die(json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]));
}
?>