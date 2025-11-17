-- Migration: Sistema Centralizado de Preços e Exit Intent
-- Descrição: Cria tabelas offers e exit_intent_feedback para centralizar preços e capturar feedback de usuários

-- Criar enum OfferType
DO $$ BEGIN
    CREATE TYPE "OfferType" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela offers
CREATE TABLE IF NOT EXISTS offers (
    id VARCHAR(255) PRIMARY KEY,
    type "OfferType" NOT NULL,
    price_in_cents INTEGER NOT NULL,
    stripe_price_id VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índices para offers
CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(type);
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON offers(is_active);

-- Criar constraint única para garantir apenas uma oferta ativa por tipo
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_offer_per_type ON offers(type, is_active) WHERE is_active = true;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at na tabela offers
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Criar tabela exit_intent_feedback
CREATE TABLE IF NOT EXISTS exit_intent_feedback (
    id VARCHAR(255) PRIMARY KEY,
    reason VARCHAR(255) NOT NULL,
    suggested_price_in_cents INTEGER NULL,
    page VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índices para exit_intent_feedback
CREATE INDEX IF NOT EXISTS idx_exit_intent_feedback_reason ON exit_intent_feedback(reason);
CREATE INDEX IF NOT EXISTS idx_exit_intent_feedback_created_at ON exit_intent_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_exit_intent_feedback_page ON exit_intent_feedback(page);

-- Inserir dados iniciais (valores padrão - IDs do Stripe devem ser inseridos manualmente)
INSERT INTO offers (id, type, price_in_cents, stripe_price_id, is_active, currency, created_at, updated_at)
VALUES 
    ('prod_premium_monthly', 'MONTHLY', 1990, NULL, true, 'BRL', NOW(), NOW()),
    ('prod_premium_annual', 'ANNUAL', 18990, NULL, true, 'BRL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE offers IS 'Tabela centralizada de ofertas/preços da plataforma';
COMMENT ON COLUMN offers.id IS 'Identificador único da oferta (ex: prod_premium_monthly)';
COMMENT ON COLUMN offers.type IS 'Tipo da oferta: MONTHLY ou ANNUAL';
COMMENT ON COLUMN offers.price_in_cents IS 'Preço em centavos (ex: 1990 = R$ 19,90)';
COMMENT ON COLUMN offers.stripe_price_id IS 'ID do preço no Stripe (deve ser preenchido manualmente após criação no Stripe)';
COMMENT ON COLUMN offers.is_active IS 'Se a oferta está ativa e disponível para venda';

COMMENT ON TABLE exit_intent_feedback IS 'Feedback capturado quando usuário tenta sair da página de planos/checkout';
COMMENT ON COLUMN exit_intent_feedback.reason IS 'Motivo da saída: price_too_high, missing_features, just_browsing';
COMMENT ON COLUMN exit_intent_feedback.suggested_price_in_cents IS 'Preço sugerido pelo usuário em centavos (apenas se reason = price_too_high)';
COMMENT ON COLUMN exit_intent_feedback.page IS 'Página onde ocorreu o exit intent (ex: /planos, /checkout)';

