# Approved order security and dependency fixes

Scope approved after audit: S1 + H1 together, then compatible dependency updates. Preserve existing discount/delivery rules. No gateway redesign, major upgrades, unrelated UI cleanup, or historical order edits.

1. Add regression tests for tampered base/size/modifier prices and invalid options, plus canonical saved extras, spiciness, schedule, and idempotent retries.
2. Add a migration replacing only the private order-submission core. Resolve actual catalog prices and option labels, validate claimed totals, preserve existing promo/fee/idempotency rules, and store authoritative line details. Keep public analytics wrapper and access restrictions intact.
3. Serialize stable modifier IDs and schedule from checkout; map saved canonical details for admin display, with fallback for old records. Test and build before a separate security commit.
4. Verify SQL in an isolated PostgreSQL database before production. Back up production before applying; compare historical-order hashes; do not submit test customer orders into production. Review changes before merge/deploy.
5. Update direct and transitive packages within their current major versions; retain Node22 typings and plugin-react5. No force/major upgrades. Update lockfile, run tests/build/audit, and commit separately.
6. Verify production menu/admin/order request serialization after deployment without creating a real order. Report exact behavior changes and remaining audit decisions.

Progress: implementation starting. Working tree was clean; branch fix/authoritative-order-pricing based on origin/main78a7d0a.
