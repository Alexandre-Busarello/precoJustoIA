-- Add is_alert_active column to user_asset_monitor table
ALTER TABLE "user_asset_monitor" ADD COLUMN "is_alert_active" BOOLEAN NOT NULL DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "user_asset_monitor_is_active_is_alert_active_idx" ON "user_asset_monitor"("is_active", "is_alert_active");

-- Initialize all existing monitors with is_alert_active = false
UPDATE "user_asset_monitor" SET "is_alert_active" = false WHERE "is_alert_active" IS NULL;

