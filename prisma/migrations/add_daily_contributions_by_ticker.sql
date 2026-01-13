-- Migration: Add daily_contributions_by_ticker column to index_history_points
-- This column stores the daily contribution of each asset to the index points calculation
-- Format: JSON object with ticker as key and contribution percentage as value
-- Example: { "PETR4": 0.25, "VALE3": -0.15, "ITUB4": 0.10 }

ALTER TABLE index_history_points
ADD COLUMN IF NOT EXISTS daily_contributions_by_ticker JSONB;

-- Add comment to column
COMMENT ON COLUMN index_history_points.daily_contributions_by_ticker IS 'Daily contribution of each asset to the index points calculation (in percentage). Format: { "TICKER": contribution_percentage }';

