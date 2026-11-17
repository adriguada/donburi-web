import type { ApiError, Dish, DishInput, Menu, NewDishInput, Section, SectionInput } from "../shared/types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiError["error"] | undefined;

  constructor(status: number, message: string, code?: ApiError["error"]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!response.ok) {
    let payload: Partial<ApiError> = {};
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      // Non-JSON error (e.g. a proxy error page).
    }
    throw new ApiRequestError(
      response.status,
      payload.message ?? `Error inesperado (${response.status}).`,
      payload.error,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  getMenu: () => request<Menu>("GET", "/api/menu"),
  createSection: (input: SectionInput) => request<Section>("POST", "/api/section", input),
  updateSection: (id: number, input: SectionInput) => request<Section>("PUT", `/api/section/${id}`, input),
  deleteSection: (id: number) => request<void>("DELETE", `/api/section/${id}`),
  createDish: (input: NewDishInput) => request<Dish>("POST", "/api/dish", input),
  updateDish: (id: number, input: DishInput) => request<Dish>("PUT", `/api/dish/${id}`, input),
  deleteDish: (id: number) => request<void>("DELETE", `/api/dish/${id}`),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}
