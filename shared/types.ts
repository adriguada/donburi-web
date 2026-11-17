// Types shared between the Worker API (worker/) and the React client (src/).

export interface Dish {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  /** Price in euros (e.g. 12.5). Stored as integer cents in D1. */
  price: number;
  isSpicy: boolean;
}

export interface Section {
  id: number;
  title: string;
  dishes: Dish[];
}

export interface Menu {
  sections: Section[];
}

export interface SectionInput {
  title: string;
}

export interface DishInput {
  name: string;
  description?: string | null;
  price: number;
  isSpicy: boolean;
}

export interface NewDishInput extends DishInput {
  sectionId: number;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SECTION_EXISTS"
  | "DISH_EXISTS"
  | "UNAUTHORIZED"
  | "AUTH_NOT_CONFIGURED";

export interface ApiError {
  error: ApiErrorCode;
  message: string;
}
