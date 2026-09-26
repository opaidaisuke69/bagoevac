-- Proof-of-image for rescue requests. Populated from the triggering disaster
-- report (or the evacuee's latest report) so barangay officials can see photo
-- evidence attached to a rescue request.
ALTER TABLE rescue_requests
    ADD COLUMN photo_path VARCHAR(500) DEFAULT NULL AFTER status_at_request;
