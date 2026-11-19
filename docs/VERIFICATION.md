# Verification — 19 November 2026

Source version2.0.0, strict original CSP11 scope.

- Syntax: npm run check passed.
- Automated suite:37 passed,0 failed,0 skipped.
- Backend statements/lines:93.06%; branches87.23%; functions94.33%.
- 100 concurrent requests:20 confirmed,80 waitlisted,0 failed,p95=472.36ms.
- 300 concurrent requests:20 confirmed,280 waitlisted,0 failed,p95=848.49ms.
- Copy restore: integrity_check=ok;1514 invented users,60 classes,300 bookings.
- HTTP cancellation-to-promotion evidence is in evidence/promotion-results.json.
- Real UI: member booking confirmed; separate gate/class QR cards; desk status search; manager dashboard; instructor tablet roster.
- Embedded browser at360px: dashboard page width345px without page overflow. Other screens/devices still need full testing.

Environment: Windows, Node24.14.1, Intel i7-8650U, single process, disk SQLite WAL and loopback HTTP. Sessions pre-created before the burst. No WAN/TLS/proxy included.
The original hosted website was not deployed or performance-tested for this version.

## Reproduce

Install Node24.10+ within24, then:

    npm ci --ignore-scripts
    npm run check
    npm test
    npm run load

For matching load DB restore, set DATABASE_PATH=data/load-test.db, then npm run backup.
Ordinary npm run backup needs first app startup and uses data/csp11.db.
The restore check copies the backup, opens the copy, checks integrity and reads record counts. It does not replace the source DB.

## Scope of test changes

Removed obsolete custom-scope acceptance files for password login, class-end-only no-show and120s QR.
Retained applicable booking, HTTP, language, QR decoder, class lifecycle and capacity regressions.
The new csp11 tests cover restored roles, gate, suspension, overrides, history, renewal and calendar retention.
The report distinguishes measured results from pending human/hosted release gates.
