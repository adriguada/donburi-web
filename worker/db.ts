import type { Dish, DishInput, Menu, NewDishInput, Section, SectionInput } from "../shared/types";
import { toCents } from "./validation";

interface SectionRow {
  id: number;
  title: string;
  title_ja: string | null;
}

const SECTION_COLUMNS = "id, title, title_ja";

function toSection(row: SectionRow, dishes: Dish[] = []): Section {
  return { id: row.id, title: row.title, titleJa: row.title_ja, dishes };
}

interface DishRow {
  id: number;
  section_id: number;
  name: string;
  description: string | null;
  price_cents: number;
  spiciness: number;
}

/** Result of a write: the stored entity, or why it could not be written. */
export type WriteResult<T> = { ok: true; value: T } | { ok: false; reason: "not_found" | "conflict" };

const DISH_COLUMNS = "id, section_id, name, description, price_cents, spiciness";

function toDish(row: DishRow): Dish {
  return {
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    description: row.description,
    price: row.price_cents / 100,
    spiciness: row.spiciness,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function getMenu(db: D1Database): Promise<Menu> {
  const [sections, dishes] = await db.batch([
    db.prepare(`SELECT ${SECTION_COLUMNS} FROM sections ORDER BY "order", id`),
    db.prepare(`SELECT ${DISH_COLUMNS} FROM dishes ORDER BY id`),
  ]);
  const bySection = new Map<number, Section>();
  for (const row of sections.results as SectionRow[]) {
    bySection.set(row.id, toSection(row));
  }
  for (const row of dishes.results as DishRow[]) {
    bySection.get(row.section_id)?.dishes.push(toDish(row));
  }
  return { sections: [...bySection.values()] };
}

async function getSection(db: D1Database, id: number): Promise<Section | null> {
  const row = await db.prepare(`SELECT ${SECTION_COLUMNS} FROM sections WHERE id = ?`).bind(id).first<SectionRow>();
  if (!row) return null;
  const dishes = await db
    .prepare(`SELECT ${DISH_COLUMNS} FROM dishes WHERE section_id = ? ORDER BY id`)
    .bind(id)
    .all<DishRow>();
  return toSection(row, dishes.results.map(toDish));
}

export async function createSection(db: D1Database, input: SectionInput): Promise<WriteResult<Section>> {
  try {
    const row = await db
      .prepare(
        `INSERT INTO sections (title, title_ja, "order")
         VALUES (?, ?, (SELECT COALESCE(MAX("order"), 0) + 1 FROM sections))
         RETURNING ${SECTION_COLUMNS}`,
      )
      .bind(input.title, input.titleJa ?? null)
      .first<SectionRow>();
    return { ok: true, value: toSection(row!) };
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
    const result = await db
      .prepare("UPDATE sections SET title = ?, title_ja = ? WHERE id = ?")
      .bind(input.title, input.titleJa ?? null, id).run();
    if (result.meta.changes === 0) return { ok: false, reason: "not_found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
  return { ok: true, value: (await getSection(db, id))! };
}

/**
 * Sets the order of the sections on the menu (AD1.1.4). `sectionIds` must list
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
        `INSERT INTO dishes (section_id, name, description, price_cents, spiciness)
         VALUES (?, ?, ?, ?, ?) RETURNING ${DISH_COLUMNS}`,
      )
      .bind(input.sectionId, input.name, input.description ?? null, toCents(input.price), input.spiciness ?? 0)
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
        `UPDATE dishes SET name = ?, description = ?, price_cents = ?, spiciness = ?
         WHERE id = ? RETURNING ${DISH_COLUMNS}`,
      )
      .bind(input.name, input.description ?? null, toCents(input.price), input.spiciness ?? 0, id)
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
