# Spec: AI Analysis

## Purpose
Define AI-powered features using Google Gemini: individual stock analysis reports, AI predictive ranking, AI-assisted screening, AI portfolio analysis, YouTube sentiment analysis, and IBOV projections. Ben (the conversational assistant) has its own spec. PREMIUM-only except where noted.

## Requirements

### Requirement: AI Stock Analysis Report (/acao/[ticker])
The system SHALL generate AI-powered analysis reports for individual stocks using Google Gemini.
Reports (stored in AIReport) SHALL include: valuation summary from all 7 models, qualitative analysis,
recent news context, macroeconomic factors, and a contextual buy/hold/watch assessment.
This feature MUST be PREMIUM-only.

#### Scenario: Report generation
- **WHEN** a PREMIUM user clicks "Gerar Análise IA" on a stock page
- **THEN** Gemini is called with the stock's full fundamental data + news search enabled,
  a structured AIReport is created, and the result streams to the user within 30 seconds

#### Scenario: Report caching
- **WHEN** the same report is requested within 24 hours
- **THEN** the cached AIReport is served without calling Gemini again

#### Scenario: User rates report
- **WHEN** user clicks thumbs up/down on an AI report
- **THEN** an AIReportFeedback record is created linking the user, report, and rating/reason

---

### Requirement: AI Predictive Ranking
The system SHALL allow Gemini to produce a ranked list of stocks
analyzing all 7 quantitative models simultaneously with qualitative enrichment (news, macro).
This feature MUST be PREMIUM-only.

#### Scenario: AI ranking with qualitative context
- **WHEN** user runs AI Predictive Analysis
- **THEN** Gemini returns a ranked list with a 2-3 sentence qualitative rationale per stock,
  incorporating recent news from Gemini's grounding search

---

### Requirement: AI Screening Assistant (/screening-acoes)
The system SHALL provide a natural language input in the screener (POST /api/screening-ai)
where Gemini interprets the user's investment thesis and configures screener filters automatically.
This feature MUST be PREMIUM-only.

#### Scenario: Theme-based screening
- **WHEN** user inputs "quero small caps com crescimento de receita e baixo endividamento"
- **THEN** AI fills screener with: Small Cap size, CAGR Receita > 10%, Dívida Líquida/PL < 0.5

#### Scenario: AI-generated filters remain editable
- **WHEN** AI fills in the filter form
- **THEN** user can adjust any filter before running the screener

---

### Requirement: AI Portfolio Analysis
The system SHALL provide Gemini-powered portfolio analysis via:
- POST /api/portfolio/ai-assistant — qualitative portfolio health assessment
- POST /api/portfolio/transaction-ai — specific transaction recommendations

Both features MUST be PREMIUM-only.

#### Scenario: Portfolio health assessment
- **WHEN** PREMIUM user clicks "Análise IA" on their portfolio
- **THEN** Gemini assesses diversification, sector concentration, and suggests adjustments

---

### Requirement: YouTube Sentiment Analysis
The system SHALL analyze YouTube content about a company using Gemini
to extract market sentiment signals from financial YouTubers discussing the stock.

#### Scenario: YouTube analysis for a ticker
- **WHEN** the YouTube analysis feature is triggered for a company
- **THEN** Gemini processes relevant YouTube content metadata and returns a sentiment signal
  (positive/neutral/negative) with key themes mentioned

---

### Requirement: AI Report Feedback
The system SHALL allow users to rate AI-generated reports (thumbs up/down with optional text),
stored in AIReportFeedback, to improve future analyses.

#### Scenario: Negative feedback captured
- **WHEN** user rates an AI report as "não útil" with a reason
- **THEN** an AIReportFeedback record is created linked to the AIReport and user

---

### Requirement: Monthly AI Reports via Cron
The system SHALL auto-generate monthly AI analysis reports for premium users' tracked assets
via cron job (/api/cron/generate-reports or /api/ai-reports).

#### Scenario: Monthly report generation
- **WHEN** the monthly report cron runs
- **THEN** AI reports are generated for each tracked asset of premium users who have opted in,
  and notifications are sent when reports are ready

---

### Requirement: IBOV Projections (/projecoes-ibov)
The system SHALL use Gemini to generate macroeconomic-based Ibovespa projections.
Projections SHALL factor in: Selic rate, inflation (IPCA), GDP expectations, earnings growth outlook.

#### Scenario: IBOV projection generated via Ben
- **WHEN** POST /api/ben/project-ibov is called (admin-triggered)
- **THEN** Gemini generates short/medium/long-term Ibovespa outlook with documented assumptions,
  saved and displayed on /projecoes-ibov
