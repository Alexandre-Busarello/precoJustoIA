-- Add initial_capital field to backtest_configs table
ALTER TABLE "backtest_configs" ADD COLUMN "initial_capital" DECIMAL(15,2) NOT NULL DEFAULT 1000.00;

-- Update existing records to have a default initial capital of 1000
UPDATE "backtest_configs" SET "initial_capital" = 1000.00 WHERE "initial_capital" IS NULL;
