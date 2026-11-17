import type { Dish, DishInput, Menu, NewDishInput, Section, SectionInput } from "../shared/types";
import { toCents } from "./validation";

interface SectionRow {
  id: number;
  title: string;
}

interface DishRow {
  id: number;
  section_id: number;
  name: string;
  description: string | null;
  price_cents: number;
  is_spicy: number;
}

/** Result of a write: the stored entity, or why it could not be written. */
export type WriteResult<T> = { ok: true; value: T } | { ok: false; reason: "not_found" | "conflict" };

const DISH_COLUMNS = "id, section_id, name, description, price_cents, is_spicy";

function toDish(row: DishRow): Dish {
  return {
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    description: row.description,
    price: row.price_cents / 100,
    isSpicy: row.is_spicy === 1,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function getMenu(db: D1Database): Promise<Menu> {
  const [sections, dishes] = await db.batch([
    db.prepare('SELECT id, title FROM sections ORDER BY "order", id'),
    db.prepare(`SELECT ${DISH_COLUMNS} FROM dishes ORDER BY id`),
  ]);
  const bySection = new Map<number, Section>();
  for (const row of sections.results as SectionRow[]) {
    bySection.set(row.id, { id: row.id, title: row.title, dishes: [] });
  }
  for (const row of dishes.results as DishRow[]) {
    bySection.get(row.section_id)?.dishes.push(toDish(row));
  }
  return { sections: [...bySection.values()] };
}

async function getSection(db: D1Database, id: number): Promise<Section | null> {
  const row = await db.prepare("SELECT id, title FROM sections WHERE id = ?").bind(id).first<SectionRow>();
  if (!row) return null;
  const dishes = await db
    .prepare(`SELECT ${DISH_COLUMNS} FROM dishes WHERE section_id = ? ORDER BY id`)
    .bind(id)
    .all<DishRow>();
  return { id: row.id, title: row.title, dishes: dishes.results.map(toDish) };
}

export async function createSection(db: D1Database, input: SectionInput): Promise<WriteResult<Section>> {
  try {
    const row = await db
      .prepare(
        `INSERT INTO sections (title, "order")
         VALUES (?, (SELECT COALESCE(MAX("order"), 0) + 1 FROM sections))
         RETURNING id, title`,
      )
      .bind(input.title)
      .first<SectionRow>();
    return { ok: true, value: { id: row!.id, title: row!.title, dishes: [] } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
}

export async function updateSection(
  db: D1Database,
  id: number,
  input: SectionInput,
): Promise<WriteResult<Section>> {
  try {
    const result = await db.prepare("UPDATE sections SET title = ? WHERE id = ?").bind(input.title, id).run();
    if (result.meta.changes === 0) return { ok: false, reason: "not_found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
  return { ok: true, value: (await getSection(db, id))! };
}

/**
 * Sets the order of the sections on the menu (AD1.2). `sectionIds` must list
 * every existing section exactly once; otherwise nothing changes and the
 * result is a conflict (the admin is looking at a stale menu).
 */
export async function reorderSections(db: D1Database, sectionIds: number[]): Promise<WriteResult<Menu>> {
  const existing = await db.prepare("SELECT id FROM sections").all<{ id: number }>();
  const existingIds = new Set(existing.results.map((row) => row.id));
  if (existingIds.size !== sectionIds.length || !sectionIds.every((id) => existingIds.has(id))) {
    return { ok: false, reason: "conflict" };
  }
  if (sectionIds.length > 0) {
    await db.batch(
      sectionIds.map((id, index) => db.prepare('UPDATE sections SET "order" = ? WHERE id = ?').bind(index + 1, id)),
    );
  }
  return { ok: true, value: await getMenu(db) };
}

/** Deletes a section and every dish in it, atomically. Returns false if the section does not exist. */
export async function deleteSection(db: D1Database, id: number): Promise<boolean> {
  const [, section] = await db.batch([
    db.prepare("DELETE FROM dishes WHERE section_id = ?").bind(id),
    db.prepare("DELETE FROM sections WHERE id = ?").bind(id),
  ]);
  return section.meta.changes > 0;
}

export async function createDish(db: D1Database, input: NewDishInput): Promise<WriteResult<Dish>> {
  const section = await db.prepare("SELECT id FROM sections WHERE id = ?").bind(input.sectionId).first();
  if (!section) return { ok: false, reason: "not_found" };
  try {
    const row = await db
      .prepare(
        `INSERT INTO dishes (section_id, name, description, price_cents, is_spicy)
         VALUES (?, ?, ?, ?, ?) RETURNING ${DISH_COLUMNS}`,
      )
      .bind(input.sectionId, input.name, input.description ?? null, toCents(input.price), input.isSpicy ? 1 : 0)
      .first<DishRow>();
    return { ok: true, value: toDish(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
}

export async function updateDish(db: D1Database, id: number, input: DishInput): Promise<WriteResult<Dish>> {
  try {
    const row = await db
      .prepare(
        `UPDATE dishes SET name = ?, description = ?, price_cents = ?, is_spicy = ?
         WHERE id = ? RETURNING ${DISH_COLUMNS}`,
      )
      .bind(input.name, input.description ?? null, toCents(input.price), input.isSpicy ? 1 : 0, id)
      .first<DishRow>();
    if (!row) return { ok: false, reason: "not_found" };
    return { ok: true, value: toDish(row) };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
}

export async function deleteDish(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM dishes WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}
