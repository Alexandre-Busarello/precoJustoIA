-- Migration: Add email and unsubscribeToken to user_asset_subscriptions
-- Allows anonymous subscriptions (without userId) for LGPD compliance
-- SEGURO: Não causa perda de dados - apenas adiciona colunas e índices

-- Step 1: Make userId nullable (seguro - não remove dados)
ALTER TABLE user_asset_subscriptions 
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add email column (nullable, seguro - coluna nova)
ALTER TABLE user_asset_subscriptions 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 3: Add unsubscribeToken column (nullable, seguro - coluna nova)
ALTER TABLE user_asset_subscriptions 
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

-- Step 4: Drop existing unique constraint on (user_id, company_id) se existir
-- Seguro: vamos recriar como índice parcial
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_asset_subscriptions_user_id_company_id_key'
  ) THEN
    ALTER TABLE user_asset_subscriptions 
      DROP CONSTRAINT user_asset_subscriptions_user_id_company_id_key;
  END IF;
END $$;

-- Step 5: Criar índice único parcial para user subscriptions (apenas quando user_id não é null)
-- Seguro: não afeta registros existentes, apenas garante unicidade para novos
DROP INDEX IF EXISTS unique_user_company;
CREATE UNIQUE INDEX unique_user_company 
  ON user_asset_subscriptions (user_id, company_id) 
  WHERE user_id IS NOT NULL;

-- Step 6: Criar índice único parcial para email subscriptions (apenas quando email não é null)
-- Seguro: coluna email é nova, não há dados duplicados
DROP INDEX IF EXISTS unique_email_company;
CREATE UNIQUE INDEX unique_email_company 
  ON user_asset_subscriptions (email, company_id) 
  WHERE email IS NOT NULL;

-- Step 7: Criar índice único parcial para unsubscribeToken (apenas quando não é null)
-- Seguro: coluna unsubscribe_token é nova, não há dados duplicados
DROP INDEX IF EXISTS unique_unsubscribe_token;
CREATE UNIQUE INDEX unique_unsubscribe_token 
  ON user_asset_subscriptions (unsubscribe_token) 
  WHERE unsubscribe_token IS NOT NULL;

-- Step 8: Add indexes for performance (seguro - apenas índices)
CREATE INDEX IF NOT EXISTS idx_user_asset_subscriptions_email 
  ON user_asset_subscriptions (email) 
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_asset_subscriptions_unsubscribe_token 
  ON user_asset_subscriptions (unsubscribe_token) 
  WHERE unsubscribe_token IS NOT NULL;

-- Step 9: Add comment for documentation
COMMENT ON COLUMN user_asset_subscriptions.email IS 'Email for anonymous subscriptions (when user_id is null)';
COMMENT ON COLUMN user_asset_subscriptions.unsubscribe_token IS 'Unique token for unsubscribe link (LGPD compliance)';

