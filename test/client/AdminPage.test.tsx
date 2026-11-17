import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Menu } from "../../shared/types";
import { isAdminPath } from "../../src/routes";
import { AdminPage } from "../../src/pages/AdminPage";
import { callsTo, menuSequence, mockFetch } from "./fetch-mock";

const ramenMenu: Menu = {
  sections: [
    {
      id: 1,
      title: "Ramen",
      dishes: [
        { id: 10, sectionId: 1, name: "Shoyu", description: "Clásico", price: 12, isSpicy: false },
        { id: 11, sectionId: 1, name: "Miso", description: null, price: 12.5, isSpicy: false },
      ],
    },
  ],
};

describe("isAdminPath", () => {
  it.each([
    ["/admin", true],
    ["/admin/", true],
    ["/admin/anything", true],
    ["/", false],
    ["/administrator", false],
  ])("%s → %s", (path, expected) => {
    expect(isAdminPath(path)).toBe(expected);
  });
});

describe("AdminPage", () => {
  it("adds a new section (AD1.1.1)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence({ sections: [] }, { sections: [{ id: 1, title: "Entrantes", dishes: [] }] }),
      "POST /api/section": () => ({ status: 201, body: { id: 1, title: "Entrantes", dishes: [] } }),
    });
    render(<AdminPage />);
    await screen.findByText("La carta no tiene secciones todavía.");

    await user.type(screen.getByLabelText("Nueva sección"), "Entrantes");
    await user.click(screen.getByRole("button", { name: "Añadir sección" }));

    expect(await screen.findByRole("region", { name: "Entrantes" })).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST", "/api/section")).toEqual([{ title: "Entrantes" }]);
    expect(screen.getByLabelText("Nueva sección")).toHaveValue("");
  });

  it("requires a name for a new section without calling the API (AD1.1.1.1)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "GET /api/menu": menuSequence({ sections: [] }) });
    render(<AdminPage />);
    await user.click(await screen.findByRole("button", { name: "Añadir sección" }));
    expect(screen.getByRole("alert")).toHaveTextContent("El nombre de la sección es obligatorio.");
    expect(callsTo(fetchMock, "POST", "/api/section")).toEqual([]);
  });

  it("shows the API error when the section already exists (AD1.1.1.1.1)", async () => {
    const user = userEvent.setup();
    mockFetch({
      "GET /api/menu": menuSequence(ramenMenu),
      "POST /api/section": () => ({
        status: 409,
        body: { error: "SECTION_EXISTS", message: "Ya existe una sección con ese nombre en la carta." },
      }),
    });
    render(<AdminPage />);
    await user.type(await screen.findByLabelText("Nueva sección"), "Ramen");
    await user.click(screen.getByRole("button", { name: "Añadir sección" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una sección con ese nombre en la carta.");
  });

  it("renames a section (AD1.1.2.1)", async () => {
    const user = userEvent.setup();
    const renamed: Menu = { sections: [{ ...ramenMenu.sections[0], title: "Ramens" }] };
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence(ramenMenu, renamed),
      "PUT /api/section/1": () => ({ status: 200, body: renamed.sections[0] }),
    });
    render(<AdminPage />);
    await user.click(await screen.findByRole("button", { name: "Editar sección" }));
    const input = screen.getByLabelText("Nombre de la sección");
    await user.clear(input);
    await user.type(input, "Ramens");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("heading", { name: "Ramens" })).toBeInTheDocument();
    expect(callsTo(fetchMock, "PUT", "/api/section/1")).toEqual([{ title: "Ramens" }]);
  });

  it("asks for confirmation before deleting a section (AD1.1.3.1)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence(ramenMenu, { sections: [] }),
      "DELETE /api/section/1": () => ({ status: 204 }),
    });
    render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: "Eliminar sección" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent('¿Eliminar la sección "Ramen" y todos sus platos?');
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(callsTo(fetchMock, "DELETE", "/api/section/1")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Eliminar sección" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await screen.findByText("La carta no tiene secciones todavía.");
    expect(callsTo(fetchMock, "DELETE", "/api/section/1")).toHaveLength(1);
  });

  it("adds a dish with name, description, price and spicy flag (AD1.1.2.2.1)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence(ramenMenu),
      "POST /api/dish": () => ({
        status: 201,
        body: { id: 12, sectionId: 1, name: "Tantanmen", description: "Con sésamo", price: 14.5, isSpicy: true },
      }),
    });
    render(<AdminPage />);
    await user.click(await screen.findByText("Añadir plato", { selector: "summary" }));
    const form = screen.getByTestId("add-dish-form");
    await user.type(within(form).getByLabelText("Nombre"), "Tantanmen");
    await user.type(within(form).getByLabelText("Descripción (opcional)"), "Con sésamo");
    await user.type(within(form).getByLabelText("Precio (€)"), "14,5");
    await user.click(within(form).getByLabelText("Picante"));
    await user.click(within(form).getByRole("button", { name: "Añadir plato" }));

    await waitFor(() =>
      expect(callsTo(fetchMock, "POST", "/api/dish")).toEqual([
        { sectionId: 1, name: "Tantanmen", description: "Con sésamo", price: 14.5, isSpicy: true },
      ]),
    );
    await waitFor(() => expect(within(form).getByLabelText("Nombre")).toHaveValue(""));
  });

  it("validates the dish price before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "GET /api/menu": menuSequence(ramenMenu) });
    render(<AdminPage />);
    await user.click(await screen.findByText("Añadir plato", { selector: "summary" }));
    const form = screen.getByTestId("add-dish-form");
    await user.type(within(form).getByLabelText("Nombre"), "Gyozas");
    await user.type(within(form).getByLabelText("Precio (€)"), "abc");
    await user.click(within(form).getByRole("button", { name: "Añadir plato" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Introduce un precio válido.");
    expect(callsTo(fetchMock, "POST", "/api/dish")).toHaveLength(0);
  });

  it("edits a dish and keeps the form open with the error on a duplicate name (AD1.1.2.2.2)", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence(ramenMenu),
      "PUT /api/dish/11": () => ({
        status: 409,
        body: { error: "DISH_EXISTS", message: "Ya existe un plato con ese nombre en esta sección." },
      }),
    });
    render(<AdminPage />);
    const dishes = await screen.findAllByTestId("admin-dish");
    await user.click(within(dishes[1]).getByRole("button", { name: "Editar plato" }));

    const form = screen.getByTestId("edit-dish-form");
    expect(within(form).getByLabelText("Precio (€)")).toHaveValue("12.5");
    const name = within(form).getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Shoyu");
    await user.click(within(form).getByRole("button", { name: "Guardar" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Ya existe un plato con ese nombre en esta sección.");
    expect(callsTo(fetchMock, "PUT", "/api/dish/11")).toEqual([
      { name: "Shoyu", description: null, price: 12.5, isSpicy: false },
    ]);
  });

  it("deletes a dish (AD1.1.2.2.3)", async () => {
    const user = userEvent.setup();
    const withoutMiso: Menu = { sections: [{ ...ramenMenu.sections[0], dishes: [ramenMenu.sections[0].dishes[0]] }] };
    const fetchMock = mockFetch({
      "GET /api/menu": menuSequence(ramenMenu, withoutMiso),
      "DELETE /api/dish/11": () => ({ status: 204 }),
    });
    render(<AdminPage />);
    const dishes = await screen.findAllByTestId("admin-dish");
    await user.click(within(dishes[1]).getByRole("button", { name: "Eliminar plato" }));
    await waitFor(() => expect(screen.getAllByTestId("admin-dish")).toHaveLength(1));
    expect(callsTo(fetchMock, "DELETE", "/api/dish/11")).toHaveLength(1);
  });
});
