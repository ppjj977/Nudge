import { createHash, randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The household a user belongs to (at most one in v1), with their role. */
export async function getMembershipForUser(
  userId: string,
): Promise<{ household: Household; role: string } | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT h.id, h.name, h.created_by, h.created_at, m.role AS member_role
          FROM household_members m JOIN households h ON h.id = m.household_id
          WHERE m.user_id = ? LIMIT 1`,
    args: [userId],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0] as unknown as Household & { member_role: string };
  return {
    household: {
      id: r.id,
      name: r.name,
      created_by: r.created_by,
      created_at: r.created_at,
    },
    role: r.member_role,
  };
}

export async function getMembers(householdId: string): Promise<Member[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT u.id, u.name, u.email, m.role
          FROM household_members m JOIN users u ON u.id = m.user_id
          WHERE m.household_id = ? ORDER BY m.created_at ASC`,
    args: [householdId],
  });
  return res.rows as unknown as Member[];
}

/** User ids of all current members — used to fan reminders out to the family. */
export async function memberIds(householdId: string): Promise<string[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT user_id FROM household_members WHERE household_id = ?",
    args: [householdId],
  });
  return (res.rows as unknown as { user_id: string }[]).map((r) => r.user_id);
}

export async function createHousehold(
  userId: string,
  name: string,
): Promise<Household> {
  await ensureSchema();
  const existing = await getMembershipForUser(userId);
  if (existing) return existing.household; // one household per user (v1)
  const id = newId("hh");
  const now = new Date().toISOString();
  const clean = name.trim() || "My family";
  await db.execute({
    sql: "INSERT INTO households (id, name, created_by, created_at) VALUES (?,?,?,?)",
    args: [id, clean, userId, now],
  });
  await db.execute({
    sql: `INSERT INTO household_members (household_id, user_id, role, created_at)
          VALUES (?,?,?,?)`,
    args: [id, userId, "owner", now],
  });
  return { id, name: clean, created_by: userId, created_at: now };
}

export async function renameHousehold(
  householdId: string,
  name: string,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE households SET name = ? WHERE id = ?",
    args: [name.trim() || "My family", householdId],
  });
}

export async function createInvite(
  householdId: string,
  email: string,
  invitedBy: string,
): Promise<string> {
  await ensureSchema();
  const token = randomBytes(24).toString("hex");
  await db.execute({
    sql: `INSERT INTO household_invites
            (id, household_id, email, token_hash, invited_by, expires_at, accepted_at, created_at)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [
      newId("inv"),
      householdId,
      email.toLowerCase().trim(),
      hash(token),
      invitedBy,
      DateTime.now().plus({ days: 7 }).toISO(),
      null,
      new Date().toISOString(),
    ],
  });
  return token;
}

export interface InviteInfo {
  id: string;
  household_id: string;
  email: string;
  householdName: string;
}

export async function getInvite(token: string): Promise<InviteInfo | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT i.id, i.household_id, i.email, i.expires_at, i.accepted_at,
                 h.name AS hh_name
          FROM household_invites i JOIN households h ON h.id = i.household_id
          WHERE i.token_hash = ? LIMIT 1`,
    args: [hash(token)],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0] as unknown as {
    id: string;
    household_id: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    hh_name: string;
  };
  if (r.accepted_at) return null;
  if (DateTime.fromISO(r.expires_at) < DateTime.now()) return null;
  return {
    id: r.id,
    household_id: r.household_id,
    email: r.email,
    householdName: r.hh_name,
  };
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema();
  const inv = await getInvite(token);
  if (!inv) return { ok: false, error: "This invite is invalid or has expired." };
  const existing = await getMembershipForUser(userId);
  if (existing) {
    if (existing.household.id === inv.household_id) {
      await markAccepted(inv.id);
      return { ok: true };
    }
    return {
      ok: false,
      error: "You're already in a family. Leave it first to join another.",
    };
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO household_members (household_id, user_id, role, created_at)
          VALUES (?,?,?,?)`,
    args: [inv.household_id, userId, "member", new Date().toISOString()],
  });
  await markAccepted(inv.id);
  return { ok: true };
}

async function markAccepted(inviteId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE household_invites SET accepted_at = ? WHERE id = ?",
    args: [new Date().toISOString(), inviteId],
  });
}

export async function leaveHousehold(userId: string): Promise<void> {
  await ensureSchema();
  const m = await getMembershipForUser(userId);
  if (!m) return;
  const hid = m.household.id;
  await db.execute({
    sql: "DELETE FROM household_members WHERE household_id = ? AND user_id = ?",
    args: [hid, userId],
  });
  // Un-share this user's tasks from the household they left.
  await db.execute({
    sql: "UPDATE tasks SET household_id = NULL WHERE user_id = ? AND household_id = ?",
    args: [userId, hid],
  });
  // Clean up an empty household.
  if ((await memberIds(hid)).length === 0) {
    await db.execute({
      sql: "UPDATE tasks SET household_id = NULL WHERE household_id = ?",
      args: [hid],
    });
    await db.execute({
      sql: "DELETE FROM household_invites WHERE household_id = ?",
      args: [hid],
    });
    await db.execute({ sql: "DELETE FROM households WHERE id = ?", args: [hid] });
  }
}

/**
 * Remove a member from the family. Owner-only; the owner cannot remove
 * themselves this way (they leave via leaveHousehold). Returns true on success,
 * false if the caller isn't the owner or the target isn't a member.
 */
export async function removeMember(
  ownerId: string,
  targetUserId: string,
): Promise<boolean> {
  await ensureSchema();
  if (ownerId === targetUserId) return false;
  const m = await getMembershipForUser(ownerId);
  if (!m || m.role !== "owner") return false;
  const hid = m.household.id;

  // Confirm the target is actually in this household.
  const inHh = await db.execute({
    sql: "SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1",
    args: [hid, targetUserId],
  });
  if (!inHh.rows.length) return false;

  await db.execute({
    sql: "DELETE FROM household_members WHERE household_id = ? AND user_id = ?",
    args: [hid, targetUserId],
  });
  // Un-share the removed member's tasks, and clear them as an assignee on the
  // family's shared tasks.
  await db.execute({
    sql: "UPDATE tasks SET household_id = NULL WHERE user_id = ? AND household_id = ?",
    args: [targetUserId, hid],
  });
  await db.execute({
    sql: "UPDATE tasks SET assignee_id = NULL WHERE household_id = ? AND assignee_id = ?",
    args: [hid, targetUserId],
  });
  return true;
}
