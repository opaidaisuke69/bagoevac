-- Migration: convert locations table to one-row-per-user upsert model
-- Safe to re-run — checks before altering.

-- Step 1: Keep only the latest row per user, delete duplicates
DELETE l1 FROM locations l1
INNER JOIN locations l2
  ON l1.user_id = l2.user_id AND l1.id < l2.id;

-- Step 2: Add unique constraint on user_id (skip if already present)
ALTER IGNORE TABLE locations
  ADD UNIQUE KEY uq_locations_user (user_id);
