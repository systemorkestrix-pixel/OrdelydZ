import { index, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { appSchema } from "./app-schema";
import { storesTable } from "./stores";

export const usersTable = appSchema.table("users", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("users_store_id_idx").on(table.storeId),
]);

export type User = typeof usersTable.$inferSelect;
