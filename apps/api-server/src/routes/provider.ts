import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  providerUsersTable,
  storesTable,
  usersTable,
} from "@workspace/db";
import { requireProviderAuth } from "../middleware/requireAuth.js";

export const providerRouter = Router();

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

function envProviderConfigured() {
  return Boolean(process.env.PROVIDER_EMAIL && (process.env.PROVIDER_PASSWORD_HASH || process.env.PROVIDER_PASSWORD));
}

async function verifyEnvProvider(email: string, password: string) {
  if (!envProviderConfigured()) return null;

  const providerEmail = normalizeEmail(process.env.PROVIDER_EMAIL);
  const providerName = String(process.env.PROVIDER_NAME ?? "Provider Admin").trim() || "Provider Admin";
  const providerId = Number(process.env.PROVIDER_ID ?? 1);
  if (email !== providerEmail) return false;

  const passwordHash = process.env.PROVIDER_PASSWORD_HASH;
  const valid = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === process.env.PROVIDER_PASSWORD;
  if (!valid) return false;

  return {
    id: Number.isFinite(providerId) && providerId > 0 ? providerId : 1,
    email: providerEmail,
    name: providerName,
  };
}

function slugBase(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomPassword() {
  return `merchant-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function uniqueStoreSlug(preferred: string, fallback: string) {
  const base = slugBase(preferred) || slugBase(fallback) || "store";
  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const [existing] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.slug, slug));
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}

function formatStore(row: {
  store: typeof storesTable.$inferSelect;
  merchantEmail: string | null;
  ordersCount: number;
}) {
  return {
    id: row.store.id,
    name: row.store.name,
    slug: row.store.slug,
    ownerName: row.store.ownerName,
    phone: row.store.phone,
    city: row.store.city,
    logoUrl: row.store.logoUrl ?? null,
    isActive: row.store.isActive,
    merchantEmail: row.merchantEmail,
    ordersCount: Number(row.ordersCount ?? 0),
    createdAt: row.store.createdAt,
  };
}

providerRouter.post("/auth/login", async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    return;
  }

  const envProvider = await verifyEnvProvider(email, password);
  if (envProvider === false) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  if (envProvider) {
    req.session.providerUserId = envProvider.id;
    req.session.providerEmail = envProvider.email;
    req.session.providerName = envProvider.name;
    res.json({ user: envProvider });
    return;
  }

  const [provider] = await db
    .select()
    .from(providerUsersTable)
    .where(eq(providerUsersTable.email, email));
  if (!provider || !(await bcrypt.compare(password, provider.passwordHash))) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  req.session.providerUserId = provider.id;
  req.session.providerEmail = provider.email;
  req.session.providerName = provider.name;
  res.json({ user: { id: provider.id, email: provider.email, name: provider.name } });
});

providerRouter.post("/auth/logout", (req, res): void => {
  delete req.session.providerUserId;
  delete req.session.providerEmail;
  delete req.session.providerName;
  res.json({ ok: true });
});

providerRouter.get("/auth/me", (req, res): void => {
  res.set("Cache-Control", "no-store");
  if (!req.session?.providerUserId) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: req.session.providerUserId,
      email: req.session.providerEmail,
      name: req.session.providerName,
    },
  });
});

providerRouter.get("/summary", requireProviderAuth, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [[storesTotal], [storesActive], [todayOrders], [todayConfirmed], [todayReturned]] = await Promise.all([
    db.select({ value: count() }).from(storesTable),
    db.select({ value: count() }).from(storesTable).where(eq(storesTable.isActive, true)),
    db.select({ value: count() }).from(ordersTable).where(gte(ordersTable.createdAt, today)),
    db.select({ value: count() }).from(ordersTable).where(and(gte(ordersTable.createdAt, today), eq(ordersTable.status, "CONFIRMED"))),
    db.select({ value: count() }).from(ordersTable).where(and(gte(ordersTable.createdAt, today), eq(ordersTable.status, "RETURNED"))),
  ]);

  res.json({
    storesTotal: storesTotal?.value ?? 0,
    storesActive: storesActive?.value ?? 0,
    storesInactive: (storesTotal?.value ?? 0) - (storesActive?.value ?? 0),
    todayOrders: todayOrders?.value ?? 0,
    todayConfirmed: todayConfirmed?.value ?? 0,
    todayReturned: todayReturned?.value ?? 0,
  });
});

providerRouter.get("/stores", requireProviderAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      store: storesTable,
      merchantEmail: usersTable.email,
      ordersCount: sql<number>`count(${ordersTable.id})::int`,
    })
    .from(storesTable)
    .leftJoin(usersTable, eq(usersTable.storeId, storesTable.id))
    .leftJoin(ordersTable, eq(ordersTable.storeId, storesTable.id))
    .groupBy(storesTable.id, usersTable.email)
    .orderBy(desc(storesTable.createdAt));

  res.json(rows.map(formatStore));
});

providerRouter.post("/stores", requireProviderAuth, async (req, res): Promise<void> => {
  const storeName = String(req.body?.storeName ?? "").trim();
  const ownerName = String(req.body?.ownerName ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim();
  const city = String(req.body?.city ?? "").trim();
  const merchantEmail = normalizeEmail(req.body?.merchantEmail);
  const requestedPassword = String(req.body?.merchantPassword ?? "").trim();

  if (!storeName || !ownerName || !phone || !city || !merchantEmail) {
    res.status(400).json({ error: "بيانات المتجر والتاجر مطلوبة" });
    return;
  }

  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, merchantEmail));
  if (existingUser) {
    res.status(409).json({ error: "بريد التاجر مستخدم من قبل" });
    return;
  }

  const password = requestedPassword.length >= 8 ? requestedPassword : randomPassword();
  const slug = await uniqueStoreSlug(req.body?.storeSlug ?? storeName, merchantEmail);
  const passwordHash = await bcrypt.hash(password, 10);

  const [store] = await db.insert(storesTable).values({
    name: storeName,
    slug,
    ownerName,
    phone,
    city,
    isActive: true,
  }).returning();

  await db.insert(usersTable).values({
    storeId: store.id,
    email: merchantEmail,
    passwordHash,
  });

  res.status(201).json({
    store: formatStore({ store, merchantEmail, ordersCount: 0 }),
    merchantPassword: password,
  });
});

providerRouter.patch("/stores/:storeId", requireProviderAuth, async (req, res): Promise<void> => {
  const storeId = Number(req.params.storeId);
  if (!storeId) {
    res.status(400).json({ error: "معرّف المتجر غير صحيح" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  for (const key of ["name", "ownerName", "phone", "city", "isActive"] as const) {
    if (key in req.body) updateData[key] = req.body[key];
  }
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }

  const [store] = await db.update(storesTable).set(updateData).where(eq(storesTable.id, storeId)).returning();
  if (!store) {
    res.status(404).json({ error: "المتجر غير موجود" });
    return;
  }

  const [merchant] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.storeId, store.id));
  const [{ ordersCount }] = await db.select({ ordersCount: count() }).from(ordersTable).where(eq(ordersTable.storeId, store.id));
  res.json(formatStore({ store, merchantEmail: merchant?.email ?? null, ordersCount }));
});

providerRouter.post("/stores/:storeId/reset-password", requireProviderAuth, async (req, res): Promise<void> => {
  const storeId = Number(req.params.storeId);
  const password = String(req.body?.password ?? "").trim() || randomPassword();
  if (!storeId || password.length < 8) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    return;
  }

  const [merchant] = await db.select().from(usersTable).where(eq(usersTable.storeId, storeId));
  if (!merchant) {
    res.status(404).json({ error: "حساب التاجر غير موجود" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, merchant.id));
  res.json({ merchantEmail: merchant.email, merchantPassword: password });
});
