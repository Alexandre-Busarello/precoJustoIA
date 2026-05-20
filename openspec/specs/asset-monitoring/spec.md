# Spec: Asset Monitoring

## Purpose
Define the asset monitoring and alert system including price alerts, technical indicator triggers, fundamental change monitors, watchlists, email subscriptions to asset reports, and the background cron that evaluates active monitors. FREE users get 1 monitor; PREMIUM users get unlimited.

## Requirements

### Requirement: Price and Trigger-based Alerts (UserAssetMonitor)
The system SHALL allow users to create asset monitors that fire when configurable conditions are met.
Each monitor stores a JSON triggerConfig supporting condition types:
- Price above/below a threshold
- Percentage price change (daily/weekly)
- Technical indicator threshold (RSI, MACD crossover)
- Fundamental indicator change (ROE, DY)
FREE users SHALL be limited to 1 active monitor; PREMIUM users SHALL have unlimited monitors.

#### Scenario: Price-above alert triggered
- **WHEN** PETR4 closes above R$42.00 and a monitor exists for this condition
- **THEN** the monitor fires, a notification is created, and lastTriggered is updated

#### Scenario: Free user limit enforced
- **WHEN** a FREE user already has 1 active monitor and tries to create another
- **THEN** the creation is blocked with an upgrade prompt

#### Scenario: Monitor auto-deactivates after trigger
- **WHEN** a monitor fires
- **THEN** isActive is set to false, preventing repeated notifications until the user resets it

---

### Requirement: Technical Indicator Triggers
The system SHALL support technical indicator-based conditions in triggerConfig:
RSI thresholds (e.g., RSI < 30 = oversold), MACD crossovers, and similar signals.

#### Scenario: RSI oversold alert
- **WHEN** a stock's RSI drops below 30 and a monitor is configured for this
- **THEN** the monitor fires with message "VALE3: RSI atingiu 28.5 (limiar: 30)"

---

### Requirement: Background Monitor Evaluation Cron
The system SHALL run a background cron that evaluates all active UserAssetMonitor records
against the latest market data and queues notifications for breached conditions.
The cron SHALL run during market hours at regular intervals (~30 minutes).

#### Scenario: Cron evaluates monitors in bulk
- **WHEN** the monitoring cron runs
- **THEN** POST /api/monitor-assets/bulk processes all active monitors, checking each triggerConfig against current data and creating Notification records for breached ones

---

### Requirement: Watchlist (Acompanhar Ações)
The system SHALL provide a watchlist where users track assets they are interested in.
The watchlist SHALL show current price, daily change %, and last update time.
Users SHALL be able to add assets from any stock, FII, or BDR page.

#### Scenario: Adding to watchlist
- **WHEN** user clicks "Acompanhar" on any asset page
- **THEN** the asset is added to the user's watchlist

#### Scenario: Watchlist on dashboard
- **WHEN** user opens the dashboard
- **THEN** their watchlist shows current prices with green/red daily change indicators

---

### Requirement: Email Subscription to Asset Reports (UserAssetSubscription)
The system SHALL allow users to subscribe to periodic email reports for specific assets
(separate from instant price alerts).
Each UserAssetSubscription records the asset ticker and report frequency.

#### Scenario: Subscribe to weekly report
- **WHEN** user subscribes to ITUB4 weekly report
- **THEN** a UserAssetSubscription is created and the user receives a weekly email with ITUB4's fundamental highlights

#### Scenario: Unsubscribe
- **WHEN** user unsubscribes from an asset report via the unsubscribe link in the email
- **THEN** the UserAssetSubscription is deactivated and no further emails are sent

---

### Requirement: Notification Preferences
The system SHALL allow users to configure notification delivery preferences via UserNotificationPreferences:
email frequency (immediate or daily digest), in-app notifications on/off.

#### Scenario: Daily digest preference
- **WHEN** user sets email preference to "Resumo Diário"
- **THEN** alert notifications are batched and sent once per day instead of immediately

---

### Requirement: In-App Notifications
The system SHALL display in-app notifications for triggered monitors.
Notifications SHALL show: asset ticker, condition that fired, current value, and timestamp.
Users SHALL be able to mark notifications as read.

#### Scenario: Notification appears in-app
- **WHEN** a monitor fires
- **THEN** a Notification record is created and a badge appears in the navigation showing unread count

#### Scenario: Mark as read
- **WHEN** user clicks the notification or POST /api/notifications/[id]/read
- **THEN** the notification is marked read and removed from the unread count
