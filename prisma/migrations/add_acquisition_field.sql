-- Migration: Add acquisition field to users table
-- This field tracks how users were acquired (e.g., "Calculadora de Dividend Yield")

ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition VARCHAR(255) NULL;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_users_acquisition ON users(acquisition);

-- Add comment to document the field
COMMENT ON COLUMN users.acquisition IS 'Tracks the source/channel through which the user was acquired (e.g., "Calculadora de Dividend Yield")';

