-- Migração para adicionar índices de performance
-- Execute este script manualmente no banco de dados para melhorar a performance

-- Índices para a tabela companies
CREATE INDEX IF NOT EXISTS "companies_sector_idx" ON "companies" ("sector");
CREATE INDEX IF NOT EXISTS "companies_industry_idx" ON "companies" ("industry");
CREATE INDEX IF NOT EXISTS "companies_sector_industry_idx" ON "companies" ("sector", "industry");

-- Índices para a tabela financial_data
CREATE INDEX IF NOT EXISTS "financial_data_company_year_idx" ON "financial_data" ("company_id", "year");
CREATE INDEX IF NOT EXISTS "financial_data_year_idx" ON "financial_data" ("year");

-- Índices para a tabela daily_quotes
CREATE INDEX IF NOT EXISTS "daily_quotes_company_date_idx" ON "daily_quotes" ("company_id", "date");
CREATE INDEX IF NOT EXISTS "daily_quotes_date_idx" ON "daily_quotes" ("date");

-- Índices para a tabela balance_sheets
CREATE INDEX IF NOT EXISTS "balance_sheets_company_period_date_idx" ON "balance_sheets" ("company_id", "period", "end_date");
CREATE INDEX IF NOT EXISTS "balance_sheets_end_date_idx" ON "balance_sheets" ("end_date");

-- Índices para a tabela income_statements
CREATE INDEX IF NOT EXISTS "income_statements_company_period_date_idx" ON "income_statements" ("company_id", "period", "end_date");
CREATE INDEX IF NOT EXISTS "income_statements_end_date_idx" ON "income_statements" ("end_date");

-- Índices para a tabela cashflow_statements
CREATE INDEX IF NOT EXISTS "cashflow_statements_company_period_date_idx" ON "cashflow_statements" ("company_id", "period", "end_date");
CREATE INDEX IF NOT EXISTS "cashflow_statements_end_date_idx" ON "cashflow_statements" ("end_date");

-- Comentários sobre os índices
COMMENT ON INDEX "companies_sector_idx" IS 'Otimiza consultas por setor na busca de concorrentes';
COMMENT ON INDEX "companies_industry_idx" IS 'Otimiza consultas por industry na busca de concorrentes';
COMMENT ON INDEX "companies_sector_industry_idx" IS 'Otimiza consultas combinadas de setor e industry';
COMMENT ON INDEX "financial_data_company_year_idx" IS 'Otimiza consultas de dados financeiros por empresa e ano';
COMMENT ON INDEX "daily_quotes_company_date_idx" IS 'Otimiza consultas de cotações por empresa e data';
COMMENT ON INDEX "balance_sheets_company_period_date_idx" IS 'Otimiza consultas de balanços por empresa, período e data';
COMMENT ON INDEX "income_statements_company_period_date_idx" IS 'Otimiza consultas de DRE por empresa, período e data';
COMMENT ON INDEX "cashflow_statements_company_period_date_idx" IS 'Otimiza consultas de DFC por empresa, período e data';
