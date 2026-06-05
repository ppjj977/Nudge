import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { getMembershipForUser } from "./households";

/**
 * Shared family lists (shopping, packing, …). A list is private to its creator
 * unless it's attached to a household, in which case every family member can
 * view and edit it. Items are simple checkable rows.
 */
export interface ListItem {
  id: string;
  list_id: string;
  text: string;
  done: boolean;
  added_by: string | null;
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  kind: string;
  created_at: string;
  updated_at: string;
  items: ListItem[];
}

const KINDS = new Set(["shopping", "packing", "custom"]);

function mapItem(r: Record<string, unknown>): ListItem {
  return {
    id: String(r.id),
    list_id: String(r.list_id),
    text: String(r.text),
    done: Boolean(r.done),
    added_by: (r.added_by as string) ?? null,
    created_at: String(r.created_at),
  };
}

/** All lists the user can see: their own plus any shared with their family. */
export async function getLists(userId: string): Promise<List[]> {
  await ensureSchema();
  const membership = await getMembershipForUser(userId);
  const householdId = membership?.household.id ?? null;

  const res = householdId
    ? await db.execute({
        sql: `SELECT * FROM lists WHERE user_id = ? OR household_id = ?
              ORDER BY updated_at DESC`,
        args: [userId, householdId],
      })
    : await db.execute({
        sql: "SELECT * FROM lists WHERE user_id = ? ORDER BY updated_at DESC",
        args: [userId],
      });

  const lists = res.rows.map((r) => ({
    ...(r as unknown as List),
    items: [] as ListItem[],
  }));
  if (lists.length === 0) return [];

  const ids = lists.map((l) => l.id);
  const placeholders = ids.map(() => "?").join(",");
  const itemsRes = await db.execute({
    sql: `SELECT * FROM list_items WHERE list_id IN (${placeholders})
          ORDER BY done ASC, created_at ASC`,
    args: ids,
  });
  const byList = new Map<string, ListItem[]>();
  for (const row of itemsRes.rows) {
    const item = mapItem(row as Record<string, unknown>);
    const arr = byList.get(item.list_id);
    if (arr) arr.push(item);
    else byList.set(item.list_id, [item]);
  }
  for (const l of lists) l.items = byList.get(l.id) ?? [];
  return lists;
}

/** A list the user may access (own or via household), or null. */
export async function getAccessibleList(
  userId: string,
  listId: string,
): Promise<List | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM lists WHERE id = ? LIMIT 1",
    args: [listId],
  });
  if (!res.rows.length) return null;
  const list = { ...(res.rows[0] as unknown as List), items: [] };
  if (list.user_id === userId) return list;
  if (list.household_id) {
    const m = await db.execute({
      sql: "SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1",
      args: [list.household_id, userId],
    });
    if (m.rows.length) return list;
  }
  return null;
}

export async function createList(
  userId: string,
  name: string,
  kind: string,
  shared: boolean,
): Promise<List> {
  await ensureSchema();
  const id = newId("lst");
  const now = new Date().toISOString();
  let householdId: string | null = null;
  if (shared) {
    const membership = await getMembershipForUser(userId);
    householdId = membership?.household.id ?? null;
  }
  const k = KINDS.has(kind) ? kind : "custom";
  await db.execute({
    sql: `INSERT INTO lists (id, user_id, household_id, name, kind, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?)`,
    args: [id, userId, householdId, name.trim() || "List", k, now, now],
  });
  return {
    id,
    user_id: userId,
    household_id: householdId,
    name: name.trim() || "List",
    kind: k,
    created_at: now,
    updated_at: now,
    items: [],
  };
}

async function touchList(listId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE lists SET updated_at = ? WHERE id = ?",
    args: [new Date().toISOString(), listId],
  });
}

export async function updateList(
  userId: string,
  listId: string,
  patch: { name?: string; shared?: boolean },
): Promise<boolean> {
  const list = await getAccessibleList(userId, listId);
  if (!list) return false;
  if (typeof patch.name === "string" && patch.name.trim()) {
    await db.execute({
      sql: "UPDATE lists SET name = ? WHERE id = ?",
      args: [patch.name.trim(), listId],
    });
  }
  if (typeof patch.shared === "boolean") {
    let householdId: string | null = null;
    if (patch.shared) {
      const membership = await getMembershipForUser(userId);
      householdId = membership?.household.id ?? null;
    }
    await db.execute({
      sql: "UPDATE lists SET household_id = ? WHERE id = ?",
      args: [householdId, listId],
    });
  }
  await touchList(listId);
  return true;
}

export async function deleteList(userId: string, listId: string): Promise<boolean> {
  const list = await getAccessibleList(userId, listId);
  if (!list) return false;
  await db.execute({ sql: "DELETE FROM list_items WHERE list_id = ?", args: [listId] });
  await db.execute({ sql: "DELETE FROM lists WHERE id = ?", args: [listId] });
  return true;
}

export async function addItem(
  userId: string,
  listId: string,
  text: string,
): Promise<ListItem | null> {
  const list = await getAccessibleList(userId, listId);
  if (!list || !text.trim()) return null;
  const id = newId("li");
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO list_items (id, list_id, text, done, added_by, created_at)
          VALUES (?,?,?,?,?,?)`,
    args: [id, listId, text.trim(), 0, userId, now],
  });
  await touchList(listId);
  return { id, list_id: listId, text: text.trim(), done: false, added_by: userId, created_at: now };
}

export async function updateItem(
  userId: string,
  listId: string,
  itemId: string,
  patch: { done?: boolean; text?: string },
): Promise<boolean> {
  const list = await getAccessibleList(userId, listId);
  if (!list) return false;
  if (typeof patch.done === "boolean") {
    await db.execute({
      sql: "UPDATE list_items SET done = ? WHERE id = ? AND list_id = ?",
      args: [patch.done ? 1 : 0, itemId, listId],
    });
  }
  if (typeof patch.text === "string" && patch.text.trim()) {
    await db.execute({
      sql: "UPDATE list_items SET text = ? WHERE id = ? AND list_id = ?",
      args: [patch.text.trim(), itemId, listId],
    });
  }
  await touchList(listId);
  return true;
}

export async function deleteItem(
  userId: string,
  listId: string,
  itemId: string,
): Promise<boolean> {
  const list = await getAccessibleList(userId, listId);
  if (!list) return false;
  await db.execute({
    sql: "DELETE FROM list_items WHERE id = ? AND list_id = ?",
    args: [itemId, listId],
  });
  await touchList(listId);
  return true;
}
