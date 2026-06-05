import { db, ensureSchema } from "./db";
import { leaveHousehold } from "./households";

/**
 * Permanently delete a user and all of their data (Google Play account-deletion
 * requirement). Order respects foreign keys (PRAGMA foreign_keys = ON):
 * detach from any household, clear references from other rows, then delete the
 * user's own rows, then the user.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await ensureSchema();

  const u = await db.execute({
    sql: "SELECT email FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  if (u.rows.length === 0) return;
  const email = (u.rows[0] as unknown as { email: string }).email;

  // Leave their household first (un-shares their tasks, removes membership,
  // and deletes the household if it's now empty).
  await leaveHousehold(userId);

  // Any household they created that still has other members: hand it over so
  // the created_by foreign key doesn't block the user delete.
  const created = await db.execute({
    sql: "SELECT id FROM households WHERE created_by = ?",
    args: [userId],
  });
  for (const row of created.rows as unknown as { id: string }[]) {
    const other = await db.execute({
      sql: "SELECT user_id FROM household_members WHERE household_id = ? AND user_id != ? LIMIT 1",
      args: [row.id, userId],
    });
    if (other.rows.length) {
      const newOwner = (other.rows[0] as unknown as { user_id: string }).user_id;
      await db.execute({
        sql: "UPDATE households SET created_by = ? WHERE id = ?",
        args: [newOwner, row.id],
      });
      await db.execute({
        sql: "UPDATE household_members SET role = 'owner' WHERE household_id = ? AND user_id = ?",
        args: [row.id, newOwner],
      });
    }
  }

  // Clear references others hold to this user.
  await db.execute({
    sql: "UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?",
    args: [userId],
  });
  // Reminders for this user, and any reminders on this user's tasks (which may
  // have been fanned out to family members) — remove before deleting tasks.
  await db.execute({ sql: "DELETE FROM reminders WHERE user_id = ?", args: [userId] });
  await db.execute({
    sql: "DELETE FROM reminders WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?)",
    args: [userId],
  });

  // The user's own rows.
  await db.execute({ sql: "DELETE FROM push_subscriptions WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM tasks WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM captures WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM digest_log WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM household_invites WHERE invited_by = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM auth_tokens WHERE email = ?", args: [email] });

  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
}
