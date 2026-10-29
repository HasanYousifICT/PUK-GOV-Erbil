import { db } from "@/lib/db";

const KEEP_DAYS = 90;

export type NotificationRow = { id: string; type: string; params: Record<string, string | number | boolean | null>; link: Record<string, unknown> | null; read: boolean; createdAt: string };

const parse = (s: string) => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

export async function listFor(kind: "user" | "candidate", recipientId: string) {
  // forget old ones now and then
  if (Math.random() < 0.05) {
    await db.notification.deleteMany({ where: { recipientKind: kind, recipientId, createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86400000) } } }).catch(() => undefined);
  }
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { recipientKind: kind, recipientId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40 }),
    db.notification.count({ where: { recipientKind: kind, recipientId, read: false } }),
  ]);
  const items: NotificationRow[] = rows.map((r) => ({ id: r.id, type: r.type, params: parse(r.params) ?? {}, link: parse(r.link), read: r.read, createdAt: r.createdAt.toISOString() }));
  return { items, unread };
}

export async function markRead(kind: "user" | "candidate", recipientId: string, body: { ids?: unknown; all?: unknown }) {
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  await db.notification.updateMany({
    where: { recipientKind: kind, recipientId, read: false, ...(body.all === true ? {} : { id: { in: ids } }) },
    data: { read: true },
  });
}
