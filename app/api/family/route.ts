import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { items, members } from "../../../db/schema";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nasha-semya:${value}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function memberFrom(request: Request) {
  const encodedName = request.headers.get("x-family-name") ?? "";
  let name = "";
  try { name = decodeURIComponent(encodedName); } catch { return null; }
  const pin = request.headers.get("x-family-pin") ?? "";
  if (!name || !pin) return null;
  const [member] = await getDb().select().from(members).where(and(eq(members.name, name), eq(members.pinHash, await hash(pin)))).limit(1);
  return member ?? null;
}
export async function GET(request: Request) {
  const db = getDb();
  const count = await db.select().from(members).limit(1);
  if (!count.length) return Response.json({ configured: false });
  const member = await memberFrom(request);
  if (!member) return Response.json({ configured: true, error: "Неверное имя или PIN" }, { status: 401 });
  const rows = await db.select().from(items).where(or(eq(items.isPrivate, false), and(eq(items.isPrivate, true), eq(items.owner, member.name))));
  return Response.json({ configured: true, member: member.name, items: rows });
}
export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "setup") {
    if ((await db.select().from(members).limit(1)).length) return Response.json({ error: "Семья уже настроена" }, { status: 409 });
    const svetlanaPin = String(body.svetlanaPin ?? ""), alexeyPin = String(body.alexeyPin ?? "");
    if (!/^\d{4,8}$/.test(svetlanaPin) || !/^\d{4,8}$/.test(alexeyPin)) return Response.json({ error: "PIN должен содержать 4–8 цифр" }, { status: 400 });
    await db.batch([db.insert(members).values({ name: "Светлана", pinHash: await hash(svetlanaPin) }), db.insert(members).values({ name: "Алексей", pinHash: await hash(alexeyPin) })]);
    return Response.json({ ok: true });
  }
  const member = await memberFrom(request);
  if (!member) return Response.json({ error: "Нужен вход" }, { status: 401 });
  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "Введите название" }, { status: 400 });
  const [row] = await db.insert(items).values({
    kind: String(body.kind ?? "task"), title, owner: body.isPrivate ? member.name : String(body.owner ?? "Общее"),
    details: String(body.details ?? ""), status: String(body.status ?? "planned"), dueDate: String(body.dueDate ?? ""),
    amount: Number(body.amount ?? 0), isPrivate: Boolean(body.isPrivate), createdAt: new Date().toISOString(),
  }).returning();
  return Response.json({ item: row }, { status: 201 });
}
export async function PATCH(request: Request) {
  const member = await memberFrom(request);
  if (!member) return Response.json({ error: "Нужен вход" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>, id = Number(body.id), db = getDb();
  const [current] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!current || (current.isPrivate && current.owner !== member.name)) return Response.json({ error: "Нет доступа" }, { status: 403 });
  const [row] = await db.update(items).set({ status: String(body.status ?? current.status) }).where(eq(items.id, id)).returning();
  return Response.json({ item: row });
}
export async function DELETE(request: Request) {
  const member = await memberFrom(request);
  if (!member) return Response.json({ error: "Нужен вход" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id")), db = getDb();
  const [current] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!current || (current.isPrivate && current.owner !== member.name)) return Response.json({ error: "Нет доступа" }, { status: 403 });
  await db.delete(items).where(eq(items.id, id));
  return Response.json({ ok: true });
}
