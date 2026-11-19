import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase, seed } from "../src/db.js";
import { createService } from "../src/service.js";
import { createApp } from "../src/server.js";
import { startTestApp, login } from "./http-helpers.js";

const BASE = Date.UTC(2026, 10, 19, 9),
  MIN = 60000,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR;
function fixture() {
  const db = openDatabase(":memory:");
  seed(db, BASE, { demo: true });
  let now = BASE;
  const service = createService(db, {
    clock: () => now,
    secret: randomBytes(48).toString("base64url"),
  });
  db.prepare("UPDATE classes SET starts=?,ends=?,capacity=1 WHERE id=1").run(
    BASE + HOUR,
    BASE + 2 * HOUR,
  );
  return { db, s: service, at: (t) => (now = t), close: () => db.close() };
}
function previousAbsences(f, user, days = [1, 2]) {
  days.forEach((d, i) =>
    f.db
      .prepare(
        "INSERT INTO bookings(user_id,class_id,state,created,no_show_at) VALUES (?,?,'no_show',?,?)",
      )
      .run(user, 20 + i, BASE - d * DAY, BASE - d * DAY),
  );
}

test("FR01 default startup uses simulated OIDC with four roles and no password records", async () => {
  const app = await createApp({ databasePath: ":memory:", jobs: false });
  try {
    assert.equal(app.demo, true);
    assert.deepEqual(
      app.db
        .prepare("SELECT DISTINCT role FROM users ORDER BY role")
        .all()
        .map((x) => x.role),
      ["desk", "instructor", "manager", "member"],
    );
    assert.equal(
      app.db
        .prepare(
          "SELECT COUNT(*) n FROM sqlite_master WHERE name='credentials'",
        )
        .get().n,
      0,
    );
    assert.equal(app.db.prepare("SELECT COUNT(*) n FROM users").get().n, 1514);
  } finally {
    app.dispose();
  }
});

test("FR01 OIDC authorization-code flow authenticates all four roles; password routes are absent", async () => {
  const app = await startTestApp();
  try {
    assert.equal(
      (await (await fetch(app.origin + "/auth/config")).json()).mode,
      "oidc",
    );
    for (const [id, role] of [
      ["member-1", "member"],
      ["instructor-1", "instructor"],
      ["desk", "desk"],
      ["manager", "manager"],
    ]) {
      const c = await login(app.origin, id);
      assert.equal(c.bootstrap.user.role, role);
    }
    const r = await fetch(app.origin + "/auth/local/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(r.status, 404);
    assert.equal(
      app.db
        .prepare(
          "SELECT COUNT(*) n FROM sqlite_master WHERE name='credentials'",
        )
        .get().n,
      0,
    );
  } finally {
    await app.close();
  }
});

test("FR02 FR04 FR15 HTTP role boundaries allow manager publication and desk status only", async () => {
  const app = await startTestApp();
  try {
    const student = await login(app.origin),
      teacher = await login(app.origin, "instructor-1"),
      desk = await login(app.origin, "desk"),
      manager = await login(app.origin, "manager");
    assert.equal((await desk.api("/members?q=member-1")).status, 200);
    for (const c of [student, teacher, desk]) {
      assert.equal((await c.api("/classes", "POST", {})).status, 403);
      assert.equal((await c.api("/plans", "POST", {})).status, 403);
      assert.equal((await c.api("/dashboard")).status, 403);
      assert.equal((await c.api("/audit")).status, 403);
    }
    assert.equal((await teacher.api("/classes/1")).status, 200);
    const next = Date.now() + 8 * HOUR;
    const created = await manager.api("/classes", "POST", {
      type: "yoga",
      title: "Strict acceptance class",
      instructorId: "instructor-1",
      studio: "isolated-room",
      starts: next,
      ends: next + HOUR,
      capacity: 2,
    });
    assert.equal(created.status, 201);
  } finally {
    await app.close();
  }
});

test("FR03 desk sells a simulated membership and idempotent retry creates one payment", async () => {
  const app = await startTestApp();
  try {
    const desk = await login(app.origin, "desk"),
      student = await login(app.origin),
      manager = await login(app.origin, "manager");
    const plan = await (
      await manager.api("/plans", "POST", {
        name: "Strict plan",
        price: 1000,
        days: 30,
        types: ["yoga"],
      })
    ).json();
    const headers = { "idempotency-key": randomBytes(12).toString("hex") };
    const first = await desk.api(
      "/memberships",
      "POST",
      { userId: "member-1400", planId: plan.id },
      headers,
    );
    assert.equal(first.status, 201);
    const a = await first.json();
    const second = await desk.api(
      "/memberships",
      "POST",
      { userId: "member-1400", planId: plan.id },
      headers,
    );
    assert.equal(second.status, 201);
    assert.equal((await second.json()).id, a.id);
    assert.equal(
      app.db
        .prepare("SELECT COUNT(*) n FROM payments WHERE membership_id=?")
        .get(a.id).n,
      1,
    );
    const response = await student.api(
      "/memberships",
      "POST",
      { userId: "member-1400", planId: plan.id },
      { "idempotency-key": randomBytes(12).toString("hex") },
    );
    assert.equal(response.status, 201);
    assert.equal((await response.json()).user_id, "member-1");
  } finally {
    await app.close();
  }
});

test("FR10 no-show occurs exactly ten minutes after start and promotes FIFO atomically", () => {
  const f = fixture();
  try {
    const first = f.s.book("member-1", 1),
      wait = f.s.book("member-2", 1);
    f.at(BASE + HOUR + 10 * MIN - 1);
    f.s.tick();
    assert.equal(
      f.s.one("SELECT state FROM bookings WHERE id=?", first.id).state,
      "confirmed",
    );
    f.at(BASE + HOUR + 10 * MIN);
    f.s.tick();
    assert.equal(
      f.s.one("SELECT state FROM bookings WHERE id=?", first.id).state,
      "no_show",
    );
    assert.equal(
      f.s.one("SELECT state FROM bookings WHERE id=?", wait.id).state,
      "confirmed",
    );
    assert.equal(
      f.s.one(
        "SELECT COUNT(*) n FROM bookings WHERE class_id=1 AND state='confirmed'",
      ).n,
      1,
    );
    f.s.tick();
    assert.equal(
      f.s.one(
        "SELECT COUNT(*) n FROM notifications WHERE user_id='member-1' AND kind='no_show'",
      ).n,
      1,
    );
    assert.equal(
      f.s.one(
        "SELECT COUNT(*) n FROM notifications WHERE user_id='member-2' AND kind='promotion'",
      ).n,
      1,
    );
    f.at(BASE + HOUR + 11 * MIN);
    assert.equal(
      f.s.checkIn({ id: "instructor-1", role: "instructor" }, 1, "member-2")
        .checkedIn,
      true,
    );
  } finally {
    f.close();
  }
});

test("FR10 three no-shows within thirty days suspend for seven days without duplicate extension", () => {
  const f = fixture();
  try {
    previousAbsences(f, "member-1");
    f.s.book("member-1", 1);
    f.at(BASE + HOUR + 10 * MIN);
    f.s.tick();
    const row = f.s.suspension("member-1");
    assert.ok(row);
    assert.equal(row.ends - row.starts, 7 * DAY);
    f.db
      .prepare("UPDATE classes SET starts=?,ends=? WHERE id=3")
      .run(row.starts + DAY, row.starts + DAY + HOUR);
    assert.throws(
      () => f.s.book("member-1", 3),
      (e) => e.code === "SUSPENDED",
    );
    f.s.tick();
    assert.equal(
      f.s.one("SELECT COUNT(*) n FROM suspensions WHERE user_id='member-1'").n,
      1,
    );
    f.at(row.ends - 1);
    assert.ok(f.s.suspension("member-1"));
    f.at(row.ends);
    assert.equal(f.s.suspension("member-1"), undefined);
  } finally {
    f.close();
  }
});

test("FR10 no-shows older than thirty days do not cause a suspension", () => {
  const f = fixture();
  try {
    previousAbsences(f, "member-1", [31, 32]);
    f.s.book("member-1", 1);
    f.at(BASE + HOUR + 10 * MIN);
    f.s.tick();
    assert.equal(f.s.suspension("member-1"), undefined);
  } finally {
    f.close();
  }
});

test("FR15 override requires staff and a reason and creates an audit event", () => {
  const f = fixture();
  try {
    previousAbsences(f, "member-1");
    f.s.book("member-1", 1);
    f.at(BASE + HOUR + 10 * MIN);
    f.s.tick();
    assert.throws(
      () =>
        f.s.overrideSuspension(
          { id: "member-2", role: "member" },
          "member-1",
          "Medical reason",
        ),
      (e) => e.code === "FORBIDDEN",
    );
    assert.throws(
      () =>
        f.s.overrideSuspension({ id: "desk", role: "desk" }, "member-1", ""),
      (e) => e.code === "REASON_REQUIRED",
    );
    f.s.overrideSuspension(
      { id: "desk", role: "desk" },
      "member-1",
      "Verified medical explanation",
    );
    assert.equal(f.s.suspension("member-1"), undefined);
    assert.equal(
      f.s.one("SELECT COUNT(*) n FROM audit WHERE action='suspension.override'")
        .n,
      1,
    );
    const row = f.s.one("SELECT * FROM suspensions WHERE user_id='member-1'");
    assert.equal(row.overridden_by, "desk");
    assert.equal(row.override_reason, "Verified medical explanation");
  } finally {
    f.close();
  }
});

test("FR08 gate needs membership without a class booking and rejects same-token replay", () => {
  const f = fixture();
  try {
    const desk = { id: "desk", role: "desk" };
    const token = f.s.makeToken("entry", "member-1");
    assert.equal(f.s.scanEntry(desk, token).allowed, true);
    assert.equal(f.s.scanEntry(desk, token).code, "REPLAY");
    assert.equal(
      f.s.one("SELECT COUNT(*) n FROM entries WHERE result='allowed'").n,
      1,
    );
    assert.equal(
      f.s.scanEntry(desk, f.s.makeToken("entry", "member-1400")).code,
      "MEMBERSHIP_REQUIRED",
    );
    assert.throws(
      () => f.s.scanEntry({ id: "member-1", role: "member" }, token),
      (e) => e.code === "FORBIDDEN",
    );
    assert.throws(
      () => f.s.scanEntry(desk, token + "x"),
      (e) => e.code === "INVALID_TOKEN",
    );
    assert.throws(
      () => f.s.scanEntry(desk, f.s.makeToken("membership", "member-1")),
      (e) => e.code === "INVALID_TOKEN",
    );
  } finally {
    f.close();
  }
});

test("NFR03 pass remains stable within a minute and changes at the sixty-second boundary", () => {
  const f = fixture();
  try {
    const first = f.s.makeToken("entry", "member-1");
    f.at(BASE + 59999);
    assert.equal(f.s.makeToken("entry", "member-1"), first);
    assert.equal(f.s.verifyToken(first, "entry").exp, BASE + 60000);
    f.at(BASE + 60000);
    assert.notEqual(f.s.makeToken("entry", "member-1"), first);
    assert.throws(
      () => f.s.verifyToken(first, "entry"),
      (e) => e.code === "EXPIRED_TOKEN",
    );
  } finally {
    f.close();
  }
});

test("FR09 assigned instructor tablet check-in respects booking and the ten-minute boundary", () => {
  const f = fixture();
  try {
    const b = f.s.book("member-1", 1),
      teacher = { id: "instructor-1", role: "instructor" };
    f.at(BASE + HOUR - 1);
    assert.throws(
      () => f.s.checkIn(teacher, 1, "member-1"),
      (e) => e.code === "CHECKIN_WINDOW",
    );
    f.at(BASE + HOUR + 9 * MIN);
    assert.throws(
      () =>
        f.s.checkIn({ id: "instructor-2", role: "instructor" }, 1, "member-1"),
      (e) => e.code === "FORBIDDEN",
    );
    assert.throws(
      () => f.s.checkIn(teacher, 1, "member-2"),
      (e) => e.code === "NOT_BOOKED",
    );
    assert.equal(f.s.checkIn(teacher, 1, "member-1").checkedIn, true);
    assert.equal(f.s.checkIn(teacher, 1, "member-1").alreadyCheckedIn, true);
    f.at(BASE + 2 * HOUR);
    f.s.tick();
    assert.equal(
      f.s.one("SELECT state FROM bookings WHERE id=?", b.id).state,
      "attended",
    );
  } finally {
    f.close();
  }
});

test("FR08 FR13 FR15 HTTP gate, suspension and manager gate dashboard work end to end", async () => {
  const app = await startTestApp();
  try {
    const student = await login(app.origin),
      desk = await login(app.origin, "desk"),
      manager = await login(app.origin, "manager"),
      teacher = await login(app.origin, "instructor-1");
    const pass = await (await student.api("/entry-pass")).json();
    assert.equal(
      (await teacher.api("/gate-entries", "POST", { token: pass.token }))
        .status,
      403,
    );
    assert.equal(
      (
        await desk.api("/gate-entries", "POST", {
          token: pass.token,
          gate: "main",
        })
      ).status,
      200,
    );
    assert.equal(
      (await desk.api("/gate-entries", "POST", { token: pass.token })).status,
      403,
    );
    const dashboard = await (await manager.api("/dashboard")).json();
    assert.equal(dashboard.entriesByHour[0].count, 1);
    assert.ok(dashboard.weekly);
    assert.ok(dashboard.activeMembers > 0);
    app.db
      .prepare(
        "INSERT INTO suspensions(user_id,starts,ends,reason) VALUES (?,?,?,?)",
      )
      .run("member-1", Date.now() - MIN, Date.now() + 7 * DAY, "Review test");
    assert.ok(
      (await (await desk.api("/members?q=member-1")).json()).data.find(
        (x) => x.id === "member-1",
      ).suspension,
    );
    assert.equal(
      (
        await student.api("/members/member-1/suspension-override", "POST", {
          reason: "Medical note",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await desk.api("/members/member-1/suspension-override", "POST", {
          reason: "x",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await desk.api("/members/member-1/suspension-override", "POST", {
          reason: "Verified medical note",
        })
      ).status,
      200,
    );
    assert.equal(app.service.suspension("member-1"), undefined);
  } finally {
    await app.close();
  }
});

test("FR14 attendance history and streaks never include another member's records", async () => {
  const app = await startTestApp();
  try {
    app.db.exec(
      "INSERT INTO bookings(user_id,class_id,state,created) VALUES ('member-1',1,'attended',1),('member-1',2,'attended',2),('member-2',3,'no_show',3)",
    );
    const student = await login(app.origin),
      desk = await login(app.origin, "desk");
    const data = await (await student.api("/attendance-history")).json();
    assert.equal(data.rows.length, 2);
    assert.equal(data.currentStreak, 2);
    assert.equal(data.bestStreak, 2);
    assert.equal((await desk.api("/attendance-history")).status, 403);
  } finally {
    await app.close();
  }
});

test("FR03 renewal starts at the active plan expiry; a retry cannot create a second charge", () => {
  const f = fixture();
  try {
    const old = f.s.membership("member-1");
    const renewed = f.s.buy("desk", "member-1", old.plan_id, "renew-one");
    assert.equal(renewed.starts, old.ends);
    assert.equal(renewed.ends, old.ends + 120 * DAY);
    assert.equal(
      f.s.buy("desk", "member-1", old.plan_id, "renew-one").id,
      renewed.id,
    );
    assert.throws(
      () => f.s.buy("desk", "member-1", old.plan_id, "renew-two"),
      (e) => e.code === "ALREADY_SUBSCRIBED",
    );
  } finally {
    f.close();
  }
});

test("NFR05 retention uses twelve calendar months across a leap year", () => {
  const f = fixture();
  try {
    const end = Date.UTC(2024, 1, 28, 12);
    f.db
      .prepare(
        "UPDATE memberships SET starts=?,ends=? WHERE user_id='member-1500'",
      )
      .run(end - DAY, end);
    f.at(Date.UTC(2025, 1, 28, 12));
    f.s.tick();
    assert.ok(f.s.one("SELECT id FROM users WHERE id='member-1500'"));
    f.at(Date.UTC(2025, 1, 28, 12) + 1);
    f.s.tick();
    assert.equal(
      f.s.one("SELECT id FROM users WHERE id='member-1500'"),
      undefined,
    );
  } finally {
    f.close();
  }
});
