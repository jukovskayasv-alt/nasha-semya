import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
});
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("planned"),
  owner: text("owner").notNull().default("Общее"),
  dueDate: text("due_date").notNull().default(""),
  amount: integer("amount").notNull().default(0),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
