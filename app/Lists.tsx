"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  text: string;
  done: boolean;
}
interface ListT {
  id: string;
  name: string;
  kind: string;
  household_id: string | null;
  items: Item[];
}

export default function Lists({
  initialLists,
  hasFamily,
}: {
  initialLists: ListT[];
  hasFamily: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [lists, setLists] = useState<ListT[]>(initialLists);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("shopping");
  const [newShared, setNewShared] = useState(hasFamily);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = () => startTransition(() => router.refresh());

  async function createList() {
    if (!newName.trim()) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName, kind: newKind, shared: newShared }),
    });
    if (res.ok) {
      const list = await res.json();
      setLists((ls) => [{ ...list, items: [] }, ...ls]);
      setNewName("");
    }
  }

  async function addItem(listId: string) {
    const text = (drafts[listId] ?? "").trim();
    if (!text) return;
    setDrafts((d) => ({ ...d, [listId]: "" }));
    const res = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const item = await res.json();
      setLists((ls) =>
        ls.map((l) => (l.id === listId ? { ...l, items: [...l.items, item] } : l)),
      );
    }
  }

  async function toggle(listId: string, item: Item) {
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((i) =>
                i.id === item.id ? { ...i, done: !i.done } : i,
              ),
            }
          : l,
      ),
    );
    await fetch(`/api/lists/${listId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
  }

  async function removeItem(listId: string, itemId: string) {
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l,
      ),
    );
    await fetch(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" });
  }

  async function toggleShared(list: ListT) {
    const shared = !list.household_id;
    setLists((ls) =>
      ls.map((l) =>
        l.id === list.id ? { ...l, household_id: shared ? "shared" : null } : l,
      ),
    );
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shared }),
    });
  }

  async function deleteList(listId: string) {
    if (!confirm("Delete this list and everything on it?")) return;
    setLists((ls) => ls.filter((l) => l.id !== listId));
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="lists">
      <div className="edit-form">
        <label className="field">
          <span>New list</span>
          <input
            value={newName}
            placeholder="e.g. Weekly shop"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createList()}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Kind</span>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              <option value="shopping">Shopping</option>
              <option value="packing">Packing</option>
              <option value="custom">Other</option>
            </select>
          </label>
          {hasFamily && (
            <label className="row" style={{ alignSelf: "end" }}>
              <input
                type="checkbox"
                checked={newShared}
                onChange={(e) => setNewShared(e.target.checked)}
              />
              <span>Share with family</span>
            </label>
          )}
        </div>
        <div className="capture-row">
          <button className="primary" onClick={createList} disabled={!newName.trim()}>
            Add list
          </button>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="empty">No lists yet. Create your first one above.</div>
      ) : (
        lists.map((list) => {
          const open = list.items.filter((i) => !i.done);
          const done = list.items.filter((i) => i.done);
          return (
            <section className="panel list-card" key={list.id}>
              <div className="list-head">
                <h2>
                  {list.kind === "shopping" ? "🛒 " : list.kind === "packing" ? "🧳 " : "📋 "}
                  {list.name}
                </h2>
                <div className="list-actions">
                  {hasFamily && (
                    <button className="link" onClick={() => toggleShared(list)}>
                      {list.household_id ? "👪 Shared" : "Share"}
                    </button>
                  )}
                  <button className="link danger" onClick={() => deleteList(list.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="add-item">
                <input
                  value={drafts[list.id] ?? ""}
                  placeholder="Add an item…"
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [list.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && addItem(list.id)}
                />
                <button onClick={() => addItem(list.id)}>Add</button>
              </div>

              <ul className="list-items">
                {open.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggle(list.id, item)}
                      />
                      <span>{item.text}</span>
                    </label>
                    <button
                      className="link danger"
                      aria-label="Remove"
                      onClick={() => removeItem(list.id, item.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {done.map((item) => (
                  <li key={item.id} className="item-done">
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggle(list.id, item)}
                      />
                      <span>{item.text}</span>
                    </label>
                    <button
                      className="link danger"
                      aria-label="Remove"
                      onClick={() => removeItem(list.id, item.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {list.items.length === 0 && (
                  <li className="muted">Nothing on this list yet.</li>
                )}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
