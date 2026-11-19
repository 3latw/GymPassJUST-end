# Acceptance record

Open means not yet verified. Do not mark a row passed without a dated result.

| Gate                               | Current result                         | Evidence needed                                                         |
| ---------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Original FR01–16 API/rules         | Implemented and automated checks pass  | Team review and live Must demonstration                                 |
| OBJ1 five people,<30s,<=3 screens  | OPEN                                   | P01–P05 task times/screens/errors; consent without personal identifiers |
| Suspension fairness                | OPEN                                   | Feedback from members; agreed rule/late-promotion handling              |
| Staff usability                    | OPEN                                   | Instructor tablet and front-desk gate/status/override task feedback     |
| Finance records                    | OPEN                                   | Finance-office signoff on simulated sales records                       |
| Chrome/Firefox/Safari/Edge current | OPEN                                   | Browser version,OS,date,roles/tasks,actual result                       |
| WCAG2.1AA                          | OPEN                                   | Keyboard/focus,labels/errors,contrast,zoom,screen reader checklist      |
| OWASP release checklist            | OPEN                                   | Reviewer,date,scope/findings/severity/fix/retest; no high/critical open |
| Dependency advisories              | OPEN                                   | Current audit output and fixes; no scan success claimed                 |
| Docker / HTTPS / external OIDC     | OPEN                                   | Container build,startup,TLS,callback/roles,rollback test                |
| Availability99.5%06–23             | OPEN                                   | Pilot date range,opening minutes,outage minutes and calculation         |
| Backup off-host/restore            | Local copy restore passes; remote OPEN | Protected backup destination and full pilot recovery rehearsal          |
| Group5–7 vs supplied4              | OPEN                                   | Supervisor confirmation or corrected roster/capacity                    |
| Section authors                    | OPEN                                   | Each named student confirms actual authored/reviewed sections           |
| Teaching staff repository member   | OPEN                                   | Correct GitHub identity and authorized invitation                       |
| Member contributions               | OPEN                                   | Real commits/reviews/timesheets; no artificial history                  |
| Part1 PDF                          | Prepared                               | Team review,then submit one PDF+repo link through course site           |

## Usability worksheet

| Participant code | Task             | Time(s) | Screens | Completed? | Error/feedback |
| ---------------- | ---------------- | ------- | ------- | ---------- | -------------- |
| P01              | Book or waitlist |         |         |            |                |
| P02              | Book or waitlist |         |         |            |                |
| P03              | Book or waitlist |         |         |            |                |
| P04              | Book or waitlist |         |         |            |                |
| P05              | Book or waitlist |         |         |            |                |

## Security review worksheet

Review access control, crypto/QR, injection, design/abuse, configuration, dependencies, identity, integrity, logging and error/failure behavior.
Existing controls: prepared SQL, escaped output, endpoint roles, session+origin+CSRF checks, OIDC nonce/state/PKCE/JWT checks,60s signed QR,gate replay history, audit and loopback-only test identities.
These are controls observed in code and tests, not an independent OWASP certification.

## Gate outage procedure to agree before pilot

Desk checks the approved offline/current-semester membership list manually, records time/member/reference/reason, escalates to IT and reconciles records after recovery.
Do not auto-admit everyone. Protect offline lists and apply the same data retention policy.
