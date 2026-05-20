# Spec: Ben

## Purpose
Define "Ben", the platform's AI-powered conversational investment assistant built on Google Gemini 2.5-flash-lite. Ben has persistent memory per user, streams responses in real time, supports public conversation sharing, calls platform tools to fetch live data, and enforces per-tier message limits.

## Requirements

### Requirement: Streaming Chat Interface (/conversas-ben)
The system SHALL provide a streaming chat interface where Ben responds in real time using Server-Sent Events (SSE).
Response tokens SHALL be streamed as they are generated — the user SHALL NOT wait for the full response before seeing output.
Ben's personality SHALL be educational, friendly, and grounded in fundamental analysis.

#### Scenario: First message in a conversation
- **WHEN** user sends a first message in a new conversation
- **THEN** a new BenConversation is created, Ben's response streams token-by-token via SSE, and both the user message and assistant response are persisted as BenMessage records

#### Scenario: Streaming interruption
- **WHEN** the SSE connection drops mid-stream
- **THEN** the partial message is discarded and the user can retry without data corruption

---

### Requirement: Persistent Memory System
The system SHALL automatically extract and store important user knowledge from conversations in BenMemory.
Each memory SHALL have: category, content, importance score (1-10), last referenced timestamp, and a source conversation reference.
Ben SHALL load relevant memories as context at the start of each conversation to provide continuity.

#### Scenario: Memory auto-extraction
- **WHEN** a conversation ends or after a threshold of messages
- **THEN** a background process evaluates the conversation and persists relevant facts to BenMemory (e.g., user's investment profile, stock preferences, risk tolerance)

#### Scenario: Memory used in next conversation
- **WHEN** user starts a new conversation with Ben
- **THEN** Ben's system prompt includes the user's stored memories ranked by importance and recency, allowing Ben to say "Você mencionou antes que prefere ações com dividendos…"

#### Scenario: Memory consolidation
- **WHEN** POST /api/ben/memory is called
- **THEN** duplicate or outdated memories are merged and low-importance memories are pruned

---

### Requirement: Tool / Function Calling
Ben SHALL be able to call platform tools to fetch live data during a conversation.
Supported tools:
- Company metrics and financial data (given a ticker)
- Technical analysis indicators
- User's portfolio information
- Market indices (IPJ-VALUE, IBOVESPA)
- Dividend projections
- AI-generated reports
- Company flags (fundamental alerts)
- Platform feature descriptions

#### Scenario: Ben fetches live stock data
- **WHEN** user asks "Como estão os fundamentos de PETR4?"
- **THEN** Ben calls the company metrics tool with ticker=PETR4, receives the data, and incorporates it into its streaming response without the user needing to navigate away

#### Scenario: Ben reads user portfolio
- **WHEN** user asks "Como está minha carteira hoje?"
- **THEN** Ben calls the portfolio tool, retrieves the user's holdings and metrics, and gives a summary

---

### Requirement: Page Context Awareness
Ben SHALL extract ticker and company context from the page URL when opened from a stock page.
The ticker context SHALL be injected into Ben's system prompt so the conversation starts focused on that asset.

#### Scenario: Ben opened from /acao/VALE3
- **WHEN** user clicks "Pergunte ao Ben" on the VALE3 page
- **THEN** the conversation starts with VALE3's data pre-loaded in context and Ben's greeting references the company

---

### Requirement: Message Limits per Tier
The system SHALL enforce message limits using a BenMessageLimitService.
FREE users SHALL have a limited number of messages per day/month.
PREMIUM users SHALL have unlimited messages.

#### Scenario: Free user hits message limit
- **WHEN** a FREE user sends a message after exhausting their daily/monthly quota
- **THEN** Ben responds with a soft refusal explaining the limit and offering an upgrade link

#### Scenario: Premium user has no limit
- **WHEN** a PREMIUM user sends messages
- **THEN** no limit check is applied and all messages are processed normally

---

### Requirement: Conversation Management
The system SHALL allow users to create, list, retrieve, and delete their conversations.
Each conversation has a title (auto-generated from first message) and a list of BenMessage records.

#### Scenario: List conversations
- **WHEN** GET /api/ben/conversations is called
- **THEN** the user's conversations are returned ordered by most recent, with title and last message preview

#### Scenario: Retrieve conversation messages
- **WHEN** GET /api/ben/conversations/[id]/messages is called
- **THEN** all BenMessage records for that conversation are returned in chronological order

---

### Requirement: Public Conversation Sharing
The system SHALL allow users to share a conversation via a unique public URL.
A shareToken is generated per conversation when sharing is enabled.
Shared conversations SHALL be read-only and viewable without authentication.

#### Scenario: Share a conversation
- **WHEN** user clicks "Compartilhar" on a conversation
- **THEN** POST /api/ben/conversations/[id]/share generates a shareToken and returns a public URL like /share/ben/[token]

#### Scenario: Viewing shared conversation
- **WHEN** an unauthenticated user opens /share/ben/[token]
- **THEN** the full conversation is displayed read-only with Ben's branding and a CTA to sign up

---

### Requirement: IBOV Projection via Ben
The system SHALL support POST /api/ben/project-ibov for generating Ibovespa outlook content.
This endpoint uses Ben/Gemini to synthesize macroeconomic data into a structured IBOV projection.

#### Scenario: Admin triggers IBOV projection
- **WHEN** POST /api/ben/project-ibov is called (admin only)
- **THEN** Gemini generates a short/medium/long-term Ibovespa outlook with key assumptions, saved and displayed on /projecoes-ibov

---

### Requirement: Interaction Tracking
The system SHALL log Ben interactions (message sent, tool called, conversation shared) via POST /api/ben/interactions.
Tracking SHALL be non-blocking — a failed tracking call MUST NOT affect the chat experience.

#### Scenario: Message interaction tracked
- **WHEN** user sends a message to Ben
- **THEN** an interaction event is queued asynchronously and does not delay the streaming response
