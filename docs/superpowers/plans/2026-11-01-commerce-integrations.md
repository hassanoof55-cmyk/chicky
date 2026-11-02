# CHICKY commerce integrations implementation plan

> For agentic workers: use executing-plans for implementation; use a parallel worker for the independent consent and analytics module.

**Goal:** Implement the four integrations requested in the supplied article using live public menu data and verified provider accounts.

**Architecture:** Keep the existing React ordering flow. Add a Node HTTP server around the Vite build for dynamic crawlable product/category HTML, XML sitemap and Google/Meta feeds. Reuse stable product and size IDs across landing pages, feeds and analytics. Public catalog requests use only the existing anonymous key, never customer exports or privileged keys.

**Tech stack:** Existing React/Vite/TypeScript, Node 22 HTTP server and node:test; no new runtime dependency.

**Spec:** This document includes the implementation brief because the user has delegated technical decisions and requested all article integrations. Additional approval stages are superseded by the user's existing instruction to execute. Provider legal agreements, new security-sensitive permissions, business policy and tax facts still require actual user action or answers.

## Global constraints

- Preserve the current menu, ordering, owner authentication, private order permissions, backups and source data.
- Never invent stock, identifiers, reviews, return promises, tax treatment or nationwide delivery.
- Public database rows are the current published catalog; filter invalid entries. No additional draft/private product model is introduced without a need in the existing app.
- All valid sizes have stable distinct catalog IDs and explicit landing page selection.
- SEO HTML and feeds have matching prices, EGP currency and public image URLs; upstream failure returns 503 rather than fabricated content.
- Analytics is off until an affirmative optional consent. No customer name, phone, address, map location or free text enters analytics.
- Pending order submission is not purchase. Completed order conversion requires a consented visitor identifier, server-side credential, tested delivery/deduplication; do not mislabel unimplemented purchase or refund events.
- No advertising campaign or paid subscription is authorized.

## Review focus

- Script/XML/CSV injection and URL validation in editable menu fields.
- Price and variant selection consistency across feeds, pages, cart and events.
- Catalog freshness, upstream outages and unknown routes without soft 404s.
- Consent refusal/revocation/reload and absence of PII or duplicate purchase events.
- Actual Google/Meta permissions, terms and diagnostics can block activation even if site code is ready.

## Task 1: Live catalog server and routes (primary agent)

Files: `chicky/server/catalog.mjs`, `chicky/server/seo.mjs`, `chicky/server/index.mjs`, `chicky/tests/catalog.test.mjs`, `chicky/tests/server.test.mjs`, `chicky/package.json`, `chicky/nixpacks.toml`.

- [ ] Test invalid data, XML escaping, CSV quoting/formula input, unique variant IDs, product URL encoding, matching prices and unavailable rows.
- [ ] Implement pure catalog normalization, Google XML, Meta CSV, sitemap and robots generation.
- [ ] Test HTTP responses with injected upstream: home/product/category HTML, missing product 404, private path noindex, catalog outage 503, path traversal prevention, HEAD and feed content types.
- [ ] Implement server with a 60-second in-memory public catalog cache and a bounded upstream request; read Supabase public URL/key from environment.
- [ ] Keep the React app root on all public pages; inject accessible real catalog HTML for crawlers/fallback and matching metadata/JSON-LD. React replaces fallback content once data loads. Product pages show the selected product and preserve customization/cart flow.
- [ ] Build, run tests, visually verify product and category routes, compare live public prices/counts.

## Task 2: Consent and storefront ecommerce events (parallel worker)

Files owned by worker: `chicky/lib/analytics.ts`, `chicky/components/AnalyticsConsent.tsx`, `chicky/tests/analytics.test.mjs`. No edits to App or Checkout by worker.

Interfaces: `trackCommerce(event, items, extra?)`, `analyticsItem(product, quantity?, size?)`, `getAnalyticsConsent()`, `setAnalyticsConsent(value)`, `initializeAnalytics(measurementId)`. Component accepts `lang` and uses same module.

- [ ] Test no tag or event before consent, accepted events allowlist and PII stripping, real item IDs/price/quantity, rejection/revocation/reload and no duplicate initialization.
- [ ] Implement optional consent banner and settings reopen with equal accept/reject choices, Arabic/English copy, accessible controls. No tag if measurement ID is missing/invalid.
- [ ] Parent wires list/select/view/add/remove/checkout/shipping/payment events only to actual user flow, without purchase on pending submission.

## Task 3: Provider setup and safe deployment (primary agent)

- [ ] Obtain Search Console verification method, deploy it and submit sitemap after verified ownership.
- [ ] Complete GA4 non-binding setup once user authorizes specific account/data-sharing choices; user accepts legal terms. Obtain real measurement ID and validate DebugView/Realtime without transmitting PII.
- [ ] Inspect Merchant account, eligibility and real business policies, then submit supported feed only when accurate shipping/tax/return details exist.
- [ ] Inspect Meta catalog access. Do not bypass no-access indicators; prepare correct feed and request owner action if catalog creation/access is blocked.
- [ ] Implement and test consented confirmed-order server conversion delivery only after GA4 property/API-secret access is authorized. No historical backfill without consent. Refund event only if an actual refund flow exists.
- [ ] Review branch, run all tests/build, deploy through existing GitHub/Coolify workflow, verify public routes/feed, existing menu/cart/checkout/admin access and provider diagnostics.
- [ ] Record exact completed items and concrete remaining account/user blockers. Do not claim provider acceptance based only on local validation.
