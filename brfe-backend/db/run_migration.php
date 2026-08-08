<?php
$pdo = new PDO('mysql:host=localhost;dbname=brfe_db', 'root', '');
$pdo->exec('DELETE l1 FROM locations l1 INNER JOIN locations l2 ON l1.user_id = l2.user_id AND l1.recorded_at < l2.recorded_at');
echo 'Duplicates removed.' . PHP_EOL;
try {
    $pdo->exec('ALTER TABLE locations ADD UNIQUE KEY uq_locations_user (user_id)');
    echo 'Unique key added.' . PHP_EOL;
} catch (Exception $e) {
    echo 'Note: ' . $e->getMessage() . PHP_EOL;
}
echo 'Done.' . PHP_EOL;
