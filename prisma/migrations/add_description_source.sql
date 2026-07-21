-- Rastrear a origem do texto em companies.description ('ai' | 'external')
-- Corrige o bug em que descrições cruas da Yahoo Finance (em inglês) eram
-- exibidas com o badge "Gerado por IA" indevidamente.
ALTER TABLE "companies"
ADD COLUMN "description_source" TEXT;
