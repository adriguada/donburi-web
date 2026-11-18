// Types shared between the Worker API (worker/) and the React client (src/).

export interface Dish {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  /** Price in euros (e.g. 12.5). Stored as integer cents in D1. */
  price: number;
  /** Number of hot peppers shown next to the dish: 0 (not spicy) to MAX_SPICINESS. */
  spiciness: number;
}

export const MAX_SPICINESS = 3;

export interface Section {
  id: number;
  title: string;
  /** Japanese title shown under the title on the menu (optional). */
  titleJa: string | null;
  dishes: Dish[];
}

export interface Menu {
  sections: Section[];
}

export interface SectionInput {
  title: string;
  /** Optional; omitted, null or blank clears it. */
  titleJa?: string | null;
}

/** Body of PUT /api/section/order: every section id, in the new order. */
export interface SectionOrderInput {
  sectionIds: number[];
}

export interface DishInput {
  name: string;
  description?: string | null;
  price: number;
  /** Integer from 0 to MAX_SPICINESS. Defaults to 0 when omitted. */
  spiciness?: number;
}

export interface NewDishInput extends DishInput {
  sectionId: number;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SECTION_EXISTS"
  | "DISH_EXISTS"
  | "ORDER_CONFLICT"
  | "UNAUTHORIZED"
  | "AUTH_NOT_CONFIGURED";

export interface ApiError {
  error: ApiErrorCode;
  message: string;
}
