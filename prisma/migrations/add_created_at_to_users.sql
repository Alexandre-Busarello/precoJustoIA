-- Adicionar campo created_at na tabela users
-- O DEFAULT CURRENT_TIMESTAMP será aplicado automaticamente aos registros existentes
ALTER TABLE "users" 
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Atualizar todos os registros existentes com a data atual
-- Isso garante que todos tenham exatamente CURRENT_TIMESTAMP (mesmo que já tenham pelo DEFAULT)
UPDATE "users" 
SET "created_at" = CURRENT_TIMESTAMP;

-- Criar índice para otimização de consultas por data de criação
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

