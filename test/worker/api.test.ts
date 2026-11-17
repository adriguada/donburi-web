import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, createDish, createSection, getMenu } from "./helpers";

describe("GET /api/menu", () => {
  it("returns an empty menu when there are no sections (CL1.5)", async () => {
    const response = await call("GET", "/api/menu");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ sections: [] });
  });

  it("returns sections in creation order with their dishes (CL1.2)", async () => {
    const starters = await createSection("Entrantes");
    const ramen = await createSection("Ramen");
    await createDish(ramen.id, "Tonkotsu", { description: "Caldo de cerdo", price: 13.5, isSpicy: false });
    await createDish(ramen.id, "Tantanmen", { price: 14, isSpicy: true });

    const menu = await getMenu();
    expect(menu.sections.map((s) => s.title)).toEqual(["Entrantes", "Ramen"]);
    expect(menu.sections[0]).toEqual({ id: starters.id, title: "Entrantes", dishes: [] });
    expect(menu.sections[1].dishes).toEqual([
      expect.objectContaining({ name: "Tonkotsu", description: "Caldo de cerdo", price: 13.5, isSpicy: false, sectionId: ramen.id }),
      expect.objectContaining({ name: "Tantanmen", description: null, price: 14, isSpicy: true }),
    ]);
  });

  it("rejects other methods", async () => {
    const response = await call("POST", "/api/menu", {});
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
});

describe("sections", () => {
  it("creates a section (AD1.1.1)", async () => {
    const response = await call("POST", "/api/section", { title: "  Postres  " });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.any(Number), title: "Postres", dishes: [] });
  });

  it("requires a title (AD1.1.1.1)", async () => {
    for (const body of [{}, { title: "" }, { title: "   " }, { title: 3 }]) {
      const response = await call("POST", "/api/section", body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
    }
  });

  it("rejects a duplicate title, ignoring case (AD1.1.1.1.1)", async () => {
    await createSection("Ramen");
    for (const title of ["Ramen", "ramen"]) {
      const response = await call("POST", "/api/section", { title });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "SECTION_EXISTS",
        message: "Ya existe una sección con ese nombre en la carta.",
      });
    }
    expect((await getMenu()).sections).toHaveLength(1);
  });

  it("renames a section and keeps its dishes (AD1.1.2.1)", async () => {
    const section = await createSection("Ramen");
    await createDish(section.id, "Shoyu");
    const response = await call("PUT", `/api/section/${section.id}`, { title: "Ramens" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: section.id, title: "Ramens", dishes: [{ name: "Shoyu" }] });
  });

  it("allows renaming a section to a different case of its own title", async () => {
    const section = await createSection("ramen");
    const response = await call("PUT", `/api/section/${section.id}`, { title: "Ramen" });
    expect(response.status).toBe(200);
  });

  it("rejects renaming a section to an existing title", async () => {
    await createSection("Ramen");
    const drinks = await createSection("Bebidas");
    const response = await call("PUT", `/api/section/${drinks.id}`, { title: "Ramen" });
    expect(response.status).toBe(409);
    expect((await getMenu()).sections.map((s) => s.title)).toEqual(["Ramen", "Bebidas"]);
  });

  it("returns 404 when updating or deleting a missing section", async () => {
    expect((await call("PUT", "/api/section/999", { title: "X" })).status).toBe(404);
    expect((await call("DELETE", "/api/section/999")).status).toBe(404);
    expect((await call("DELETE", "/api/section/abc")).status).toBe(404);
  });

  it("deletes a section and all of its dishes (AD1.1.3.2)", async () => {
    const ramen = await createSection("Ramen");
    const drinks = await createSection("Bebidas");
    await createDish(ramen.id, "Shoyu");
    await createDish(ramen.id, "Miso");
    await createDish(drinks.id, "Agua");

    const response = await call("DELETE", `/api/section/${ramen.id}`);
    expect(response.status).toBe(204);

    const menu = await getMenu();
    expect(menu.sections.map((s) => s.title)).toEqual(["Bebidas"]);
    const { count } = (await env.DB.prepare("SELECT COUNT(*) AS count FROM dishes WHERE section_id = ?")
      .bind(ramen.id)
      .first<{ count: number }>())!;
    expect(count).toBe(0);
  });

  it("rejects invalid JSON", async () => {
    const response = await call("POST", "/api/section", undefined, { rawBody: "{not json" });
    expect(response.status).toBe(400);
  });

  it("rejects unsupported methods", async () => {
    expect((await call("GET", "/api/section")).status).toBe(405);
    expect((await call("POST", "/api/section/1", { title: "x" })).status).toBe(405);
  });
});

describe("dishes", () => {
  it("creates a dish with all fields (AD1.1.2.2.1)", async () => {
    const section = await createSection("Ramen");
    const response = await call("POST", "/api/dish", {
      sectionId: section.id,
      name: "Tantanmen",
      description: "Picante con sésamo",
      price: 14.9,
      isSpicy: true,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: expect.any(Number),
      sectionId: section.id,
      name: "Tantanmen",
      description: "Picante con sésamo",
      price: 14.9,
      isSpicy: true,
    });
  });

  it("treats the description as optional", async () => {
    const section = await createSection("Bebidas");
    const response = await call("POST", "/api/dish", { sectionId: section.id, name: "Agua", price: 2, isSpicy: false });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ description: null });
  });

  it("validates name, price, isSpicy and sectionId", async () => {
    const section = await createSection("Ramen");
    const valid = { sectionId: section.id, name: "Shoyu", price: 12, isSpicy: false };
    const invalid = [
      { ...valid, name: "" },
      { ...valid, price: undefined },
      { ...valid, price: -1 },
      { ...valid, price: "12" },
      { ...valid, isSpicy: "yes" },
      { ...valid, sectionId: undefined },
      { ...valid, description: 42 },
    ];
    for (const body of invalid) {
      const response = await call("POST", "/api/dish", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("returns 404 when the section does not exist", async () => {
    const response = await call("POST", "/api/dish", { sectionId: 999, name: "Shoyu", price: 12, isSpicy: false });
    expect(response.status).toBe(404);
  });

  it("rejects a duplicate name in the same section (AD1.1.2.2.2.1.1)", async () => {
    const section = await createSection("Ramen");
    await createDish(section.id, "Shoyu");
    const response = await call("POST", "/api/dish", { sectionId: section.id, name: "shoyu", price: 1, isSpicy: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "DISH_EXISTS",
      message: "Ya existe un plato con ese nombre en esta sección.",
    });
    expect((await getMenu()).sections[0].dishes).toHaveLength(1);
  });

  it("allows the same name in different sections", async () => {
    const lunch = await createSection("Menú del día");
    const dinner = await createSection("Cena");
    await createDish(lunch.id, "Gyozas");
    const response = await call("POST", "/api/dish", { sectionId: dinner.id, name: "Gyozas", price: 6, isSpicy: false });
    expect(response.status).toBe(201);
  });

  it("updates name, description, price and isSpicy (AD1.1.2.2.2)", async () => {
    const section = await createSection("Ramen");
    const dish = await createDish(section.id, "Shoyu", { description: "Clásico", price: 12 });
    const response = await call("PUT", `/api/dish/${dish.id}`, {
      name: "Shoyu especial",
      description: null,
      price: 13.25,
      isSpicy: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: dish.id,
      sectionId: section.id,
      name: "Shoyu especial",
      description: null,
      price: 13.25,
      isSpicy: true,
    });
  });

  it("rejects renaming a dish to an existing name and leaves the menu unchanged", async () => {
    const section = await createSection("Ramen");
    await createDish(section.id, "Shoyu");
    const miso = await createDish(section.id, "Miso", { price: 12 });
    const before = await getMenu();

    const response = await call("PUT", `/api/dish/${miso.id}`, { name: "Shoyu", price: 99, isSpicy: true });
    expect(response.status).toBe(409);
    expect(await getMenu()).toEqual(before);
  });

  it("deletes a dish (AD1.1.2.2.3)", async () => {
    const section = await createSection("Ramen");
    const dish = await createDish(section.id, "Shoyu");
    expect((await call("DELETE", `/api/dish/${dish.id}`)).status).toBe(204);
    expect((await getMenu()).sections[0].dishes).toEqual([]);
    expect((await call("DELETE", `/api/dish/${dish.id}`)).status).toBe(404);
  });

  it("returns 404 when updating a missing dish", async () => {
    expect((await call("PUT", "/api/dish/999", { name: "X", price: 1, isSpicy: false })).status).toBe(404);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 for unknown API paths", async () => {
    const response = await call("GET", "/api/unknown");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "NOT_FOUND" });
  });
});

describe("PUT /api/section/order (AD1.2: ordenar secciones)", () => {
  it("adds new sections at the end of the menu", async () => {
    await createSection("Ramen");
    await createSection("Postres");
    await createSection("Bebidas");
    expect((await getMenu()).sections.map((s) => s.title)).toEqual(["Ramen", "Postres", "Bebidas"]);
  });

  it("reorders the sections and returns the updated menu", async () => {
    const ramen = await createSection("Ramen");
    const desserts = await createSection("Postres");
    const starters = await createSection("Entrantes");
    await createDish(ramen.id, "Shoyu");

    const response = await call("PUT", "/api/section/order", { sectionIds: [starters.id, ramen.id, desserts.id] });
    expect(response.status).toBe(200);
    const menu = (await response.json()) as Awaited<ReturnType<typeof getMenu>>;
    expect(menu.sections.map((s) => s.title)).toEqual(["Entrantes", "Ramen", "Postres"]);
    expect(menu.sections[1].dishes.map((d) => d.name)).toEqual(["Shoyu"]);
    expect(await getMenu()).toEqual(menu);
  });

  it("puts sections created after a reorder at the end", async () => {
    const ramen = await createSection("Ramen");
    const desserts = await createSection("Postres");
    await call("PUT", "/api/section/order", { sectionIds: [desserts.id, ramen.id] });
    await createSection("Bebidas");
    expect((await getMenu()).sections.map((s) => s.title)).toEqual(["Postres", "Ramen", "Bebidas"]);
  });

  it("rejects a list that does not match the current sections, without changing the order", async () => {
    const ramen = await createSection("Ramen");
    const desserts = await createSection("Postres");
    for (const sectionIds of [[desserts.id], [desserts.id, ramen.id, 999]]) {
      const response = await call("PUT", "/api/section/order", { sectionIds });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "ORDER_CONFLICT" });
    }
    expect((await getMenu()).sections.map((s) => s.title)).toEqual(["Ramen", "Postres"]);
  });

  it("validates the body", async () => {
    for (const body of [{}, { sectionIds: "1,2" }, { sectionIds: [1, "2"] }, { sectionIds: [1, 1] }, { sectionIds: [0] }]) {
      const response = await call("PUT", "/api/section/order", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("only accepts PUT", async () => {
    const response = await call("POST", "/api/section/order", { sectionIds: [] });
    expect(response.status).toBe(405);
  });
});
