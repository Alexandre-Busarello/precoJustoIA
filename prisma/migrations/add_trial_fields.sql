-- Migration: Adicionar campos de Trial Premium
-- Descrição: Adiciona campos trial_started_at e trial_ends_at na tabela users para controle de trial de 7 dias

-- Adicionar coluna trial_started_at
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP NULL;

-- Adicionar coluna trial_ends_at
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP NULL;

-- Criar índice para otimizar consultas de trial ativo
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN users.trial_started_at IS 'Data de início do trial Premium de 7 dias';
COMMENT ON COLUMN users.trial_ends_at IS 'Data de término do trial Premium de 7 dias';

