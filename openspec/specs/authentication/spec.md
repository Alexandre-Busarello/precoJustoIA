# Spec: Authentication

## Purpose
Define user authentication (email/password + Google OAuth), subscription tiers (FREE/PREMIUM/ADMIN), Stripe and Kiwify payment integration, trial periods, feature usage limits tracked per-user, security tracking via UserSecurity, bonus usage credits, and early adopter status.

## Requirements

### Requirement: User Registration and Email Verification
The system SHALL allow users to register via email + password or Google OAuth.
After email/password registration, a verification email SHALL be sent.
Unverified users SHALL have limited access until the email is confirmed.

#### Scenario: Email registration flow
- **WHEN** user submits POST /api/auth/register with valid email and password
- **THEN** account is created, verification email is sent, and user is redirected to /verificar-email

#### Scenario: Email verification click
- **WHEN** user clicks the verification link (VerificationToken)
- **THEN** emailVerified is set, session starts, and user is redirected to the dashboard

---

### Requirement: Google OAuth and Account Linking
The system SHALL support Google OAuth sign-in via NextAuth.
Users who registered via email/password SHALL be able to link a Google account via POST /api/auth/link-google-account.

#### Scenario: Google OAuth first sign-in
- **WHEN** new user signs in with Google for the first time
- **THEN** a User + Account record are created and the user is redirected to an onboarding flow (POST /api/auth/process-oauth)

#### Scenario: New user detection
- **WHEN** GET /api/auth/check-new-user is called after OAuth
- **THEN** the system returns whether this is the user's first login, enabling onboarding triggers

---

### Requirement: Password Reset
The system SHALL provide a password reset flow via email link using PasswordResetToken.

#### Scenario: Reset email sent
- **WHEN** user submits POST /api/auth/forgot-password with a registered email
- **THEN** a PasswordResetToken (one-time, 24h TTL) is created and an email is sent with the reset link

#### Scenario: Expired reset link
- **WHEN** user clicks a reset link older than 24 hours
- **THEN** "Link expirado, solicite um novo" is shown and no password change occurs

---

### Requirement: Subscription Tiers
The system SHALL enforce three subscription tiers: FREE, PREMIUM, ADMIN.
PREMIUM access expires at premiumExpiresAt; the system SHALL auto-downgrade on the next session.

#### Scenario: Premium auto-downgrade
- **WHEN** premiumExpiresAt is in the past and no active Stripe subscription exists
- **THEN** the user is treated as FREE on next session and sees an upgrade prompt

#### Scenario: Admin access check
- **WHEN** a user with isAdmin=true navigates to /admin
- **THEN** the full admin panel is accessible

---

### Requirement: Stripe Subscription Integration
The system SHALL process PREMIUM subscriptions via Stripe webhooks.
Webhooks SHALL handle: payment_intent.succeeded, customer.subscription.deleted, invoice.payment_failed.

#### Scenario: Successful Stripe payment
- **WHEN** Stripe sends payment_intent.succeeded
- **THEN** subscriptionTier is set to PREMIUM, premiumExpiresAt is updated, and stripeSubscriptionId is stored

#### Scenario: Stripe subscription cancelled
- **WHEN** Stripe sends customer.subscription.deleted
- **THEN** premiumExpiresAt is set to now() and the user is downgraded to FREE at next login

---

### Requirement: Kiwify Payment Integration
The system SHALL accept PREMIUM activations via Kiwify webhooks as an alternative to Stripe.
Users are matched by email; kiwifyId and kiwifyOrderId are stored on successful purchase.

#### Scenario: Kiwify purchase webhook
- **WHEN** a Kiwify webhook arrives with a matching user email and status=complete
- **THEN** the user's subscriptionTier is set to PREMIUM for the purchased period

---

### Requirement: Free Trial
The system SHALL support a configurable free trial period (trialStartedAt / trialEndsAt).
Trial users access PREMIUM features until trialEndsAt.

#### Scenario: Trial period active
- **WHEN** current date is before trialEndsAt
- **THEN** the user has full PREMIUM access without payment

#### Scenario: Trial expired
- **WHEN** trialEndsAt has passed and user has not subscribed
- **THEN** user is downgraded to FREE and sees "Seu período de teste expirou" with upgrade CTA

---

### Requirement: Feature Usage Limits (FeatureUsage)
The system SHALL enforce per-feature usage limits for FREE users via FeatureUsage (monthly counts) and AnonymousFeatureUsage (IP-based for logged-out users).
GET /api/usage/check-and-record SHALL check the limit, increment the counter, and return whether the action is allowed.

#### Scenario: Free user hits AI analysis limit
- **WHEN** a FREE user has exhausted their monthly AI analysis quota
- **THEN** the system returns allowed=false and the UI shows "Você atingiu o limite do plano gratuito"

#### Scenario: Anonymous user limit
- **WHEN** an unauthenticated user performs a limited action
- **THEN** AnonymousFeatureUsage tracks it by IP hash and enforces the anonymous limit

---

### Requirement: Security Tracking (UserSecurity)
The system SHALL store security-related metadata in UserSecurity:
registration IP, last login IP, and a suspiciousActivity flag.

#### Scenario: Login IP tracked
- **WHEN** user logs in
- **THEN** the current IP is stored in UserSecurity.lastLoginIp and lastLoginAt is updated

#### Scenario: Suspicious activity flagged
- **WHEN** an admin flags an account for suspicious activity
- **THEN** UserSecurity.suspiciousActivity is set to true and the account may be restricted

---

### Requirement: Bonus Usage Credits
The system SHALL support bonusUsageCredits (integer) on the User model,
granting extra feature usage allowances beyond the tier's default limits.

#### Scenario: Bonus credits consumed
- **WHEN** a FREE user with bonusUsageCredits=5 uses a premium feature
- **THEN** one credit is deducted and the feature is granted, until credits reach 0

---

### Requirement: Early Adopter Status
The system SHALL mark early adopters (isEarlyAdopter=true, earlyAdopterDate).
Early adopters receive special benefits (discounts, bonus credits, badge).

#### Scenario: Early adopter badge shown
- **WHEN** an early adopter user logs in
- **THEN** their profile and dashboard show an "Early Adopter" badge
