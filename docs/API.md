# REST outline

Same-origin cookie session. Modifying API calls require Origin and x-csrf-token; failures use error.code/message. No password login routes.

| Method   | Path                                       | Access                                   |
| -------- | ------------------------------------------ | ---------------------------------------- |
| GET      | /auth/config,/auth/login,/auth/callback    | Public OIDC flow                         |
| GET      | /health                                    | Public health/version                    |
| GET      | /api/bootstrap                             | Authenticated current profile            |
| POST     | /api/logout                                | Authenticated                            |
| GET      | /api/plans,/api/classes                    | Authenticated                            |
| POST     | /api/plans,/api/classes                    | Manager                                  |
| GET      | /api/memberships,/api/bookings             | Own records                              |
| POST     | /api/memberships                           | Member self;desk/manager selected member |
| POST     | /api/bookings                              | Member                                   |
| POST     | /api/bookings/:id/cancellation             | Owning member                            |
| GET      | /api/classes/:id,/api/classes/:id/roster   | Manager or assigned instructor           |
| POST     | /api/classes/:id/cancellation              | Manager or assigned instructor           |
| POST     | /api/classes/:id/check-ins                 | Assigned instructor                      |
| POST     | /api/class-qr-check-ins                    | Assigned instructor;class attendance QR  |
| GET      | /api/entry-pass,/api/membership-pass       | Member;distinct signed purposes          |
| POST     | /api/gate-entries                          | Desk/manager                             |
| GET      | /api/members?q=                            | Desk/manager                             |
| POST     | /api/members/:id/suspension-override       | Desk/manager with reason                 |
| GET      | /api/attendance-history                    | Member own history and streak            |
| GET/POST | /api/notifications,/api/notifications/read | Own inbox/read update                    |
| GET      | /api/dashboard,/api/audit                  | Manager                                  |

Plan {name,price,days,types}; price is integer minor units.
Class {title,type,instructorId,studio,starts,ends,capacity}; times epoch milliseconds.
Sale {planId,userId?}, with Idempotency-Key8–100 characters.
Booking {classId}. Gate {token,gate}. Check-in {userId}. Override {reason}.
400 invalid request;401 no session;403 wrong role/CSRF/token;404 missing record;409 duplicate/conflict;422 business rule violation.
