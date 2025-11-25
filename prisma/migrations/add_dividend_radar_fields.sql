-- Adicionar campos para Radar de Dividendos na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS dividend_radar_projections JSONB,
ADD COLUMN IF NOT EXISTS dividend_radar_last_processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS dividend_radar_last_dividend_date DATE;

-- Criar índice para melhorar performance de queries que filtram por projeções
CREATE INDEX IF NOT EXISTS idx_companies_dividend_radar_last_processed 
ON companies(dividend_radar_last_processed_at) 
WHERE dividend_radar_last_processed_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN companies.dividend_radar_projections IS 'Projeções de dividendos dos próximos 12 meses geradas por IA';
COMMENT ON COLUMN companies.dividend_radar_last_processed_at IS 'Última vez que o radar de dividendos foi processado';
COMMENT ON COLUMN companies.dividend_radar_last_dividend_date IS 'Data do último dividendo usado no cálculo das projeções';

