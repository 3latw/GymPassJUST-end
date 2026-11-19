# Original CSP11 requirement trace

Baseline: CSP_11_Brief.pdf pp14–23. No custom-scope waiver is used.

| Requirement                               | Implementation                     | Automated evidence                     |
| ----------------------------------------- | ---------------------------------- | -------------------------------------- |
| FR01 simulated OIDC, four roles           | src/auth.js, server.js             | csp11 + http                           |
| FR02 manager plans                        | service.savePlan, app routes       | http                                   |
| FR03 online/desk purchase, renewal/expiry | service.buy/membership             | csp11 + http                           |
| FR04 manager timetable                    | saveClass + manager route          | csp11 + http                           |
| FR05 48h, entitlement, capacity           | book, schema triggers              | rules + scripts/load-test.js           |
| FR06 FIFO promotion                       | promote, cancel, tick transactions | csp11 + rules + HTTP promotion         |
| FR07 2h cancellation                      | cancel                             | rules exact cutoff                     |
| FR08 separate gate entry                  | makeToken, scanEntry               | csp11 purpose/expiry/replay/membership |
| FR09 instructor tablet check-in           | checkIn, scanAttendance            | csp11 + http                           |
| FR10 10m no-show,3/30,7d                  | finishClasses, suspension, book    | csp11 controlled clock                 |
| FR11 notices/reminders                    | notify, sendReminders              | rules + http                           |
| FR12 instructor cancellation              | cancelClass                        | lifecycle + rules + http               |
| FR13 fill/no-show/gate/active             | dashboard                          | csp11 + http                           |
| FR14 history/streaks                      | attendance-history route           | csp11 ownership                        |
| FR15 desk status/reasoned override        | members route, overrideSuspension  | csp11                                  |
| FR16 manager audit                        | audit route and service events     | csp11 + http                           |

CSP11 = tests/csp11.test.js; HTTP = tests/http.test.js; Rules = tests/rules.test.js; Lifecycle = tests/lifecycle.test.js.
Every row is implemented, but automated checks do not replace end-user acceptance.

| NFR                                     | Status and remaining evidence                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| 01 300 users,p95<2s                     | Local burst passes; hosted measurement pending                                         |
| 02 99.5%,06–23                          | Pilot observation pending                                                              |
| 03 HTTPS/OIDC/no passwords/roles/60s QR | Local OIDC, roles and QR pass; hosted TLS/provider pending                             |
| 04 OWASP no high/critical               | Static controls reviewed; independent review and current dependency audit pending      |
| 05 minimal data,12 months               | Calendar-year retention with leap-year boundary test; university policy review pending |
| 06 WCAG2.1AA                            | Labels/focus/semantic controls present; full review pending                            |
| 07 four browsers/360px                  | Embedded-browser/360px smoke passed; target-browser matrix pending                     |
| 08 >=70% statements                     | 93.06% combined rule/HTTP backend coverage                                             |
| 09 daily backup/restore                 | Startup+24h schedule; separate-copy restore passes; remote destination pending         |
| 10 one command/pipeline                 | Compose and CI supplied; Docker/host rehearsal pending                                 |

Design refinements: one queued renewal per plan, ordered by current expiry; newly promoted waiter gets10 minutes from confirmation within the class duration.
FR14 is optional and off the critical path. Do not remove Must requirements to accelerate it.
