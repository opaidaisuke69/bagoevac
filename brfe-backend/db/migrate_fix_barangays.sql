-- Fix barangay names to match official list
UPDATE barangays SET name = 'Dulao' WHERE id = 12;
UPDATE barangays SET name = 'Ilijan' WHERE id = 13;
UPDATE barangays SET name = 'Lag-Asan' WHERE id = 14;
UPDATE barangays SET name = 'Ma-ao Barrio' WHERE id = 15;
UPDATE barangays SET name = 'Jorge L. Araneta' WHERE id = 11;
UPDATE barangays SET name = 'Mailum' WHERE id = 16;
UPDATE barangays SET name = 'Malingin' WHERE id = 17;
UPDATE barangays SET name = 'Napoles' WHERE id = 18;
UPDATE barangays SET name = 'Pacol' WHERE id = 19;
UPDATE barangays SET name = 'Poblacion' WHERE id = 20;
UPDATE barangays SET name = 'Sagasa' WHERE id = 21;
UPDATE barangays SET name = 'Sampinit' WHERE id = 22;
UPDATE barangays SET name = 'Tabunan' WHERE id = 23;
UPDATE barangays SET name = 'Taloc' WHERE id = 24;

-- The ones that changed:
-- id 11: 'Don Jorge L. Araneta' → 'Jorge L. Araneta'
-- id 14: 'Lag-asan' → 'Lag-Asan'
-- id 15: 'Ma-ao' → 'Ma-ao Barrio'
-- id 21: 'Rizal' → 'Sagasa'
