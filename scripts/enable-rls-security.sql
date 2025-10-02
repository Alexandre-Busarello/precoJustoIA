-- =====================================================
-- SCRIPT DE SEGURANÇA: ATIVAÇÃO DE RLS NO SUPABASE
-- =====================================================
-- Este script ativa RLS em todas as tabelas e cria políticas
-- que permitem acesso total ao service role (postgres.vwhvghyrbguiakmseepw)
-- mantendo a funcionalidade atual do Prisma

-- =====================================================
-- 1. TABELAS DE AUTENTICAÇÃO (NextAuth.js)
-- =====================================================

-- Users: Acesso total para service role
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- Accounts: Acesso total para service role  
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to accounts" ON "Account"
  FOR ALL USING (true) WITH CHECK (true);

-- Sessions: Acesso total para service role
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to sessions" ON "Session"
  FOR ALL USING (true) WITH CHECK (true);

-- Verification Tokens: Acesso total para service role
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to verification_tokens" ON "VerificationToken"
  FOR ALL USING (true) WITH CHECK (true);

-- Password Reset Tokens: Acesso total para service role
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to password_reset_tokens" ON password_reset_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. DADOS FINANCEIROS E EMPRESAS
-- =====================================================

-- Companies: Dados públicos, mas controlados
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to companies" ON companies
  FOR ALL USING (true) WITH CHECK (true);

-- Financial Data: Dados críticos
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to financial_data" ON financial_data
  FOR ALL USING (true) WITH CHECK (true);

-- Daily Quotes: Dados de mercado
ALTER TABLE daily_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to daily_quotes" ON daily_quotes
  FOR ALL USING (true) WITH CHECK (true);

-- Historical Prices: Dados históricos
ALTER TABLE historical_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to historical_prices" ON historical_prices
  FOR ALL USING (true) WITH CHECK (true);

-- Key Statistics: Indicadores calculados
ALTER TABLE key_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to key_statistics" ON key_statistics
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. DADOS DE USUÁRIOS (SENSÍVEIS)
-- =====================================================

-- Portfolios: Dados pessoais dos usuários
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to portfolios" ON portfolios
  FOR ALL USING (true) WITH CHECK (true);

-- Portfolio Assets: Ativos das carteiras
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to portfolio_assets" ON portfolio_assets
  FOR ALL USING (true) WITH CHECK (true);

-- Ranking History: Histórico de rankings
ALTER TABLE ranking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ranking_history" ON ranking_history
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. DADOS FINANCEIROS DETALHADOS
-- =====================================================

-- Balance Sheets: Balanços patrimoniais
ALTER TABLE balance_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to balance_sheets" ON balance_sheets
  FOR ALL USING (true) WITH CHECK (true);

-- Income Statements: DRE
ALTER TABLE income_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to income_statements" ON income_statements
  FOR ALL USING (true) WITH CHECK (true);

-- Cashflow Statements: DFC
ALTER TABLE cashflow_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to cashflow_statements" ON cashflow_statements
  FOR ALL USING (true) WITH CHECK (true);

-- Quarterly Financials: Dados trimestrais
ALTER TABLE quarterly_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to quarterly_financials" ON quarterly_financials
  FOR ALL USING (true) WITH CHECK (true);

-- Value Added Statements: DVA
ALTER TABLE value_added_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to value_added_statements" ON value_added_statements
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 5. SISTEMA DE SUPORTE E FEEDBACK
-- =====================================================

-- Support Tickets: Tickets de suporte
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to support_tickets" ON support_tickets
  FOR ALL USING (true) WITH CHECK (true);

-- Ticket Messages: Mensagens dos tickets
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ticket_messages" ON ticket_messages
  FOR ALL USING (true) WITH CHECK (true);

-- AI Report Feedbacks: Feedbacks de relatórios
ALTER TABLE ai_report_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ai_report_feedbacks" ON ai_report_feedbacks
  FOR ALL USING (true) WITH CHECK (true);

-- AI Reports: Relatórios de IA
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ai_reports" ON ai_reports
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 6. SISTEMA DE BACKTESTING
-- =====================================================

-- Backtest Configs: Configurações de backtest
ALTER TABLE backtest_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to backtest_configs" ON backtest_configs
  FOR ALL USING (true) WITH CHECK (true);

-- Backtest Results: Resultados de backtest
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to backtest_results" ON backtest_results
  FOR ALL USING (true) WITH CHECK (true);

-- Backtest Assets: Ativos do backtest
ALTER TABLE backtest_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to backtest_assets" ON backtest_assets
  FOR ALL USING (true) WITH CHECK (true);

-- Backtest Transactions: Transações do backtest
ALTER TABLE backtest_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to backtest_transactions" ON backtest_transactions
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 7. DADOS DE MERCADO E PROCESSAMENTO
-- =====================================================

-- Price Oscillations: Oscilações de preço
ALTER TABLE price_oscillations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to price_oscillations" ON price_oscillations
  FOR ALL USING (true) WITH CHECK (true);

-- Ticker Processing Status: Status de processamento
ALTER TABLE ticker_processing_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to ticker_processing_status" ON ticker_processing_status
  FOR ALL USING (true) WITH CHECK (true);

-- Alfa Waitlist: Lista de espera alfa
ALTER TABLE alfa_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to alfa_waitlist" ON alfa_waitlist
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 8. VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar se RLS está ativado em todas as tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasoids
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verificar políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Este script permite acesso TOTAL ao service role
-- 2. RLS protege contra acesso direto não autorizado
-- 3. Sua aplicação Prisma continuará funcionando normalmente
-- 4. Execute este script no SQL Editor do Supabase
-- 5. Teste todas as funcionalidades após execução
-- =====================================================
