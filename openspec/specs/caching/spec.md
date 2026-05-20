# Spec: Caching

## Purpose
Define the Redis/Upstash caching layer including key conventions, TTL strategy by data type, intelligent cache invalidation, rate-limit caching, index real-time caching, portfolio metric caching, ISR integration, query deduplication, and admin monitoring.

## Requirements

### Requirement: Redis/Upstash Cache Layer
The system SHALL use Redis (via Upstash serverless) as the primary cache layer
for API responses and computed data via cache-service.ts.
The cache SHALL be resilient: if Redis is unavailable, the system SHALL fall back
to direct database queries without crashing.

#### Scenario: Cache hit
- **WHEN** an API route is called and the key exists in Redis with unexpired TTL
- **THEN** the cached value is returned without touching the database

#### Scenario: Redis unavailable fallback
- **WHEN** the Redis connection fails
- **THEN** the request proceeds using a database query; a warning is logged; no 500 error is returned to the client

---

### Requirement: Cache Key Conventions
Cache keys SHALL follow the pattern: `<entity>:<identifier>:<variant>`.
Examples: `company:PETR4:fundamentals`, `ranking:graham:sector-energia`, `index:IPJ-VALUE:nav`.

#### Scenario: Consistent key construction
- **WHEN** the same resource is requested with the same parameters in any order
- **THEN** the same deterministic cache key is generated

---

### Requirement: TTL Strategy by Data Type
Different data types SHALL have different TTLs enforced by cache-service.ts:
- Market quotes: 15-60 minutes
- Fundamentals: 24 hours
- AI reports: 24 hours
- Ranking results: 1 hour
- Historical prices: 7 days
- Index NAV (market hours): 15 minutes
- Index NAV (post-market): 24 hours

#### Scenario: Quote expires after 30 minutes
- **WHEN** a quote is cached at 10:00
- **THEN** the next request after 10:30 fetches fresh data from the source

---

### Requirement: Smart Query Cache with Dependency Tracking
The system SHALL implement a smart-query-cache pattern (smart-query-cache.ts) that supports
conditional cache revalidation based on tracked data dependencies.
When a dependency changes, all dependent cache entries are invalidated together.

#### Scenario: Fundamentals update invalidates dependent caches
- **WHEN** a company's fundamental data is refreshed
- **THEN** all cache keys that depend on that company's data (rankings, sector analysis, screening results) are invalidated

---

### Requirement: Rate Limit Caching
The system SHALL use a rate-limit-cache-service.ts to throttle high-frequency API endpoints.
Rate limit counters SHALL be stored in Redis with a sliding window.

#### Scenario: Rate limit enforced
- **WHEN** a single IP/user exceeds the configured request rate for an endpoint
- **THEN** subsequent requests receive 429 Too Many Requests until the window resets

---

### Requirement: Index Real-Time Cache
The system SHALL maintain a dedicated index-realtime-cache.ts for aggregating
live price data for index NAV calculation during market hours.
This cache SHALL be invalidated per market tick, not on a fixed TTL.

#### Scenario: Real-time cache updated on price tick
- **WHEN** a new price arrives for a component of IPJ-VALUE
- **THEN** the index-realtime-cache updates the component's contribution to the live NAV

---

### Requirement: Portfolio Metric Cache
The system SHALL use portfolio-cache.ts to cache computed portfolio metrics
(returns, Sharpe, drawdown) to avoid recalculating on every page load.
Cache SHALL be invalidated when new transactions are added to the portfolio.

#### Scenario: Portfolio cache hit
- **WHEN** user reloads their portfolio page within the cache TTL
- **THEN** pre-computed metrics are served instantly without recalculating from transactions

#### Scenario: Transaction invalidates portfolio cache
- **WHEN** user records a new transaction
- **THEN** the portfolio metric cache for that portfolio is immediately invalidated

---

### Requirement: ISR (Incremental Static Regeneration) Integration
The system SHALL use Next.js ISR for publicly accessible pages with infrequently changing data (e.g., company pages, sector pages), with appropriate revalidate intervals configured per page type.

#### Scenario: Company page ISR
- **WHEN** a company page is statically served
- **THEN** it revalidates in the background at the configured interval (e.g., 1 hour)
  without blocking the current request

---

### Requirement: Query Deduplication (Thundering Herd Prevention)
The system SHALL deduplicate identical concurrent in-flight requests using the smart-query-cache
to prevent multiple database queries for the same cache miss.

#### Scenario: Concurrent same-key requests coalesced
- **WHEN** 10 concurrent requests arrive for the same uncached key
- **THEN** only one database query executes; the result is shared with all 10 requestors

---

### Requirement: Cache Monitoring (Admin)
The system SHALL provide an admin cache monitor at /admin/cache-monitor showing:
active key count, memory usage, hit/miss rates, and manual invalidation controls.

#### Scenario: Manual cache flush by pattern
- **WHEN** an admin enters a key pattern and clicks "Limpar Cache"
- **THEN** all matching Redis keys are deleted immediately
