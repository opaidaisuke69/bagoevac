-- Add barangay_id to evacuation_centers
-- Run once against the live database

ALTER TABLE evacuation_centers
    ADD COLUMN barangay_id INT UNSIGNED NULL AFTER address,
    ADD CONSTRAINT fk_centers_barangay
        FOREIGN KEY (barangay_id) REFERENCES barangays(id)
        ON DELETE SET NULL;
