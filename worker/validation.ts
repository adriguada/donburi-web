import type { DishInput, NewDishInput, SectionInput, SectionOrderInput } from "../shared/types";

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_PRICE = 100_000;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, max: number): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, message: `El campo "${field}" es obligatorio.` };
  }
  const text = value.trim();
  if (text.length > max) {
    return { ok: false, message: `El campo "${field}" no puede superar ${max} caracteres.` };
  }
  return { ok: true, value: text };
}

export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parseSectionInput(body: unknown): Parsed<SectionInput> {
  if (!isRecord(body)) return { ok: false, message: "El cuerpo de la petición debe ser un objeto JSON." };
  const title = requiredText(body.title, "title", MAX_TITLE_LENGTH);
  if (!title.ok) return title;
  return { ok: true, value: { title: title.value } };
}

export function parseSectionOrder(body: unknown): Parsed<SectionOrderInput> {
  if (!isRecord(body) || !Array.isArray(body.sectionIds)) {
    return { ok: false, message: 'El campo "sectionIds" debe ser una lista de identificadores.' };
  }
  const ids = body.sectionIds;
  if (!ids.every((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) {
    return { ok: false, message: 'El campo "sectionIds" solo puede contener identificadores válidos.' };
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: 'El campo "sectionIds" no puede contener secciones repetidas.' };
  }
  return { ok: true, value: { sectionIds: ids } };
}

export function parseDishInput(body: unknown): Parsed<DishInput> {
  if (!isRecord(body)) return { ok: false, message: "El cuerpo de la petición debe ser un objeto JSON." };

  const name = requiredText(body.name, "name", MAX_TITLE_LENGTH);
  if (!name.ok) return name;

  let description: string | null = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      return { ok: false, message: 'El campo "description" debe ser texto.' };
    }
    description = body.description.trim() || null;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return {
        ok: false,
        message: `El campo "description" no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      };
    }
  }

  const price = body.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    return { ok: false, message: `El campo "price" debe ser un número entre 0 y ${MAX_PRICE}.` };
  }

  const isSpicy = body.isSpicy ?? false;
  if (typeof isSpicy !== "boolean") {
    return { ok: false, message: 'El campo "isSpicy" debe ser true o false.' };
  }

  return { ok: true, value: { name: name.value, description, price, isSpicy } };
}

export function parseNewDishInput(body: unknown): Parsed<NewDishInput> {
  const dish = parseDishInput(body);
  if (!dish.ok) return dish;
  const sectionId = (body as Record<string, unknown>).sectionId;
  if (typeof sectionId !== "number" || !Number.isSafeInteger(sectionId) || sectionId <= 0) {
    return { ok: false, message: 'El campo "sectionId" debe ser un identificador válido.' };
  }
  return { ok: true, value: { ...dish.value, sectionId } };
}

/** Converts euros to integer cents (12.5 → 1250). */
export function toCents(price: number): number {
  return Math.round(price * 100);
}
