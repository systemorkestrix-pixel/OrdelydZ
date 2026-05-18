import { Router } from "express";
import { db, landingPagesTable, pool, productCategoriesTable } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

export const productCategoriesRouter = Router({ mergeParams: true });

const CategoryInput = z.object({
  name: z.string().min(2).max(80),
  isActive: z.boolean().optional(),
});

function categorySlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "category";
}

async function ensureDefaultCategory(storeId: number): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      insert into order_os.product_categories (store_id, name, slug, is_default, is_active, sort_order)
      values ($1, 'عام', 'general', true, true, 0)
      on conflict (store_id, slug) do update
      set name = excluded.name,
          is_default = true,
          is_active = true,
          updated_at = now()
      returning id
    `,
    [storeId],
  );
  return result.rows[0].id;
}

async function uniqueSlug(storeId: number, name: string, excludeId?: number): Promise<string> {
  const base = categorySlug(name);
  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const rows = await db
      .select({ id: productCategoriesTable.id })
      .from(productCategoriesTable)
      .where(
        excludeId
          ? and(eq(productCategoriesTable.storeId, storeId), eq(productCategoriesTable.slug, slug), ne(productCategoriesTable.id, excludeId))
          : and(eq(productCategoriesTable.storeId, storeId), eq(productCategoriesTable.slug, slug)),
      );
    if (!rows[0]) return slug;
  }
  return `${base}-${Date.now()}`;
}

function formatCategory(row: Record<string, unknown>, productsCount = 0) {
  return {
    ...row,
    productsCount,
  };
}

productCategoriesRouter.get("/", async (req, res): Promise<void> => {
  const storeId = Number((req.params as { storeId?: string }).storeId);
  if (!storeId) {
    res.status(400).json({ error: "Invalid storeId" });
    return;
  }
  await ensureDefaultCategory(storeId);

  const rows = await db
    .select({
      category: productCategoriesTable,
      productsCount: sql<number>`count(${landingPagesTable.id})::int`,
    })
    .from(productCategoriesTable)
    .leftJoin(
      landingPagesTable,
      and(eq(landingPagesTable.categoryId, productCategoriesTable.id), eq(landingPagesTable.storeId, storeId)),
    )
    .where(eq(productCategoriesTable.storeId, storeId))
    .groupBy(productCategoriesTable.id)
    .orderBy(productCategoriesTable.sortOrder, productCategoriesTable.id);

  res.json(rows.map((row) => formatCategory(row.category as unknown as Record<string, unknown>, row.productsCount)));
});

productCategoriesRouter.post("/", async (req, res): Promise<void> => {
  const storeId = Number((req.params as { storeId?: string }).storeId);
  const body = CategoryInput.safeParse(req.body);
  if (!storeId || !body.success) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  await ensureDefaultCategory(storeId);
  const slug = await uniqueSlug(storeId, body.data.name);
  const [category] = await db
    .insert(productCategoriesTable)
    .values({
      storeId,
      name: body.data.name.trim(),
      slug,
      isActive: body.data.isActive ?? true,
      isDefault: false,
      sortOrder: 10,
    })
    .returning();

  res.status(201).json(formatCategory(category as unknown as Record<string, unknown>));
});

productCategoriesRouter.patch("/:categoryId", async (req, res): Promise<void> => {
  const storeId = Number((req.params as { storeId?: string }).storeId);
  const categoryId = Number(req.params.categoryId);
  const body = CategoryInput.partial().safeParse(req.body);
  if (!storeId || !categoryId || !body.success) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const [existing] = await db
    .select()
    .from(productCategoriesTable)
    .where(and(eq(productCategoriesTable.id, categoryId), eq(productCategoriesTable.storeId, storeId)));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (existing.isDefault) {
    res.status(409).json({ error: "Default category is fixed" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.name) {
    updateData.name = body.data.name.trim();
    updateData.slug = await uniqueSlug(storeId, body.data.name, categoryId);
  }
  if (body.data.isActive !== undefined) updateData.isActive = body.data.isActive;

  const [category] = await db
    .update(productCategoriesTable)
    .set(updateData)
    .where(and(eq(productCategoriesTable.id, categoryId), eq(productCategoriesTable.storeId, storeId)))
    .returning();

  res.json(formatCategory(category as unknown as Record<string, unknown>));
});

productCategoriesRouter.delete("/:categoryId", async (req, res): Promise<void> => {
  const storeId = Number((req.params as { storeId?: string }).storeId);
  const categoryId = Number(req.params.categoryId);
  if (!storeId || !categoryId) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const [existing] = await db
    .select()
    .from(productCategoriesTable)
    .where(and(eq(productCategoriesTable.id, categoryId), eq(productCategoriesTable.storeId, storeId)));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (existing.isDefault) {
    res.status(409).json({ error: "Default category cannot be deleted" });
    return;
  }

  const defaultCategoryId = await ensureDefaultCategory(storeId);
  await db.transaction(async (tx) => {
    await tx
      .update(landingPagesTable)
      .set({ categoryId: defaultCategoryId })
      .where(and(eq(landingPagesTable.storeId, storeId), eq(landingPagesTable.categoryId, categoryId)));
    await tx
      .delete(productCategoriesTable)
      .where(and(eq(productCategoriesTable.id, categoryId), eq(productCategoriesTable.storeId, storeId)));
  });

  res.status(204).send();
});
