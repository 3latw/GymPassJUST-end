# Design decisions

Three tiers: browser UI -> Node/Express API -> relational SQLite.
The server alone contacts OIDC and executes payment/notification simulation.
Plain JavaScript avoids a build step; SQLite WAL + BEGIN IMMEDIATE + capacity triggers serialize seat changes.

## Stored model

User1:N memberships/bookings/entries/suspensions/notifications.
Plan1:N memberships. Membership1:1 simulated payment.
Instructor(user)1:N classes. Class1:N bookings.
Waitlist is a booking state; queue position is derived from created/id.
ClassType is a controlled code list in public/class-types.js.
Current membership and suspension are derived from dates, not stale browser flags.
Audit stores actor/action/target/time/detail. No password table.

## Booking states

New -> confirmed if space,else waitlisted.
Waitlisted -> confirmed by FIFO,or not_promoted if ineligible/ended.
Confirmed -> checked_in by assigned instructor,or no_show at+10min.
Checked_in -> attended at class end.
Member cancellation before2h or staff class cancellation closes active bookings.
No-show -> seven-day suspension after the third event in30days.
The minute job and cancellation each promote within the same transaction.

## QR

Member sees separate gate and class cards. Purpose prevents using one in the other flow.
Gate entry needs active membership,not a class booking. HMAC verifies authenticity.
Tokens remain stable during a60s slot and change at the minute boundary; expiry is the end of that slot.
A successfully consumed gate token cannot be reused. Class check-in is idempotent and requires assignment/booking/entitlement/time.

## Controlled configuration

Plans are stored data; booking window48h,cancellation2h,no-show10m,threshold3/30days,suspension7days andQR60s are controlled source constants with boundary tests.
Identity issuer/client secrets/signing secret belong to deployment configuration and must not be committed.

## Refinements needing sponsor review

One renewal term can be queued behind an active plan.
Newly promoted members get10 minutes from promotion,limited by class end.
FR14 history/streaks is outside the critical path.
See the PDF for C4, deployment,ERD,sequences,wireframes and real screenshots.
