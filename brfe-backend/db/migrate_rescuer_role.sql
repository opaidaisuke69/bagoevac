-- Add 'Rescuer' to the lgu_accounts role enum
ALTER TABLE lgu_accounts
    MODIFY COLUMN role ENUM('LGU_Admin','Barangay_Official','Rescuer') NOT NULL;
