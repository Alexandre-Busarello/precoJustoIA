-- Adicionar campos para fase Alfa na tabela users
ALTER TABLE "users" 
ADD COLUMN "is_early_adopter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "early_adopter_date" TIMESTAMP(3),
ADD COLUMN "last_login_at" TIMESTAMP(3),
ADD COLUMN "is_inactive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inactivated_at" TIMESTAMP(3);

-- Criar tabela para lista de interesse da fase Alfa
CREATE TABLE "alfa_waitlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_at" TIMESTAMP(3),
    "is_invited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alfa_waitlist_pkey" PRIMARY KEY ("id")
);

-- Criar índices para otimização
CREATE UNIQUE INDEX "alfa_waitlist_email_key" ON "alfa_waitlist"("email");
CREATE INDEX "alfa_waitlist_created_at_idx" ON "alfa_waitlist"("created_at");
CREATE INDEX "alfa_waitlist_is_invited_idx" ON "alfa_waitlist"("is_invited");
