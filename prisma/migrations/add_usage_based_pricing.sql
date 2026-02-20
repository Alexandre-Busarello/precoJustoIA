-- Migration: Usage-based pricing - AnonymousFeatureUsage and bonusUsageCredits
-- Descrição: Adiciona tabela para rastrear uso de features por IP (anônimos) e campo de créditos bônus no cadastro

-- Adicionar coluna bonus_usage_credits na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_usage_credits INTEGER NOT NULL DEFAULT 0;

-- Criar tabela anonymous_feature_usage para rastrear uso por IP (anônimos)
CREATE TABLE IF NOT EXISTS anonymous_feature_usage (
    id VARCHAR(255) PRIMARY KEY,
    ip_hash VARCHAR(255) NOT NULL,
    feature VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NULL,
    used_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índice único para evitar duplicatas (ipHash + feature + resourceId)
CREATE UNIQUE INDEX IF NOT EXISTS anonymous_feature_usage_unique 
    ON anonymous_feature_usage(ip_hash, feature, COALESCE(resource_id, ''));

-- Índice para consultas por IP e feature
CREATE INDEX IF NOT EXISTS idx_anonymous_feature_usage_ip_feature 
    ON anonymous_feature_usage(ip_hash, feature);
