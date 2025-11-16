-- Adicionar campos de onboarding na tabela users
ALTER TABLE "users" 
ADD COLUMN "last_onboarding_seen_at" TIMESTAMP(3),
ADD COLUMN "onboarding_acquisition_source" TEXT,
ADD COLUMN "onboarding_experience_level" TEXT,
ADD COLUMN "onboarding_investment_focus" TEXT;

-- Criar índice para otimização de consultas por onboarding
CREATE INDEX "users_last_onboarding_seen_at_idx" ON "users"("last_onboarding_seen_at");

