-- Migração para criar tabela de dados históricos de preços (candlestick)
-- Execute este SQL no banco de dados ou use: prisma db push

-- Criar tabela historical_prices
CREATE TABLE IF NOT EXISTS "historical_prices" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(10,4) NOT NULL,
    "high" DECIMAL(10,4) NOT NULL,
    "low" DECIMAL(10,4) NOT NULL,
    "close" DECIMAL(10,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "adjusted_close" DECIMAL(10,4) NOT NULL,
    "interval" TEXT NOT NULL DEFAULT '1mo',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT "historical_prices_company_id_fkey" 
        FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Criar índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS "historical_prices_company_id_date_interval_key" 
    ON "historical_prices"("company_id", "date", "interval");

CREATE INDEX IF NOT EXISTS "historical_prices_company_id_interval_date_idx" 
    ON "historical_prices"("company_id", "interval", "date");

CREATE INDEX IF NOT EXISTS "historical_prices_date_idx" 
    ON "historical_prices"("date");

-- Comentários para documentação
COMMENT ON TABLE "historical_prices" IS 'Dados históricos de preços para gráficos candlestick';
COMMENT ON COLUMN "historical_prices"."interval" IS 'Intervalo dos dados: 1d, 1wk, 1mo';
COMMENT ON COLUMN "historical_prices"."volume" IS 'Volume de negociação';
COMMENT ON COLUMN "historical_prices"."adjusted_close" IS 'Preço de fechamento ajustado para dividendos/splits';
