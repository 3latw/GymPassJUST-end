import { openDatabase } from "../src/db.js";
const [email, role] = process.argv.slice(2);
if (!email || !["member", "instructor", "desk", "manager"].includes(role))
  throw new Error("Usage: node scripts/provision-role.js EMAIL ROLE");
const db = openDatabase(process.env.DATABASE_PATH || "data/csp11.db");
try {
  const user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (!user) throw new Error("The user must sign in through OIDC first");
  db.exec("BEGIN IMMEDIATE");
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role, user.id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  db.prepare(
    "INSERT INTO audit(actor,action,target,created,detail) VALUES ('operator','role.change',?,?,?)",
  ).run(user.id, Date.now(), role);
  db.exec("COMMIT");
  console.log("Role updated; sign in again");
} finally {
  db.close();
}
