// Selenium integration tests for the admin panel: PIA1–PIA8 in requirements.md.
import { By, until, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  adminDish,
  adminSection,
  createDriver,
  fill,
  getMenu,
  openAdmin,
  openMenu,
  readMenu,
  resetMenu,
  seedSection,
  waitFor,
  waitUntil,
} from "./helpers";

const RAMEN = [
  { name: "Shoyu", description: "Caldo de soja", price: 12 },
  { name: "Miso", price: 12.5 },
  { name: "Tonkotsu", price: 13.5 },
];

describe("Panel de administración (PIA)", () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await resetMenu();
  });

  async function submitNewSection(title: string) {
    const form = await waitFor(driver, "[data-testid=new-section-form]");
    await fill(form, "input[name=title]", title);
    await form.findElement(By.css("button[type=submit]")).click();
  }

  async function openAddDishForm(sectionTitle: string) {
    const section = await adminSection(driver, sectionTitle);
    await section.findElement(By.css(".add-dish summary")).click();
    return section.findElement(By.css("[data-testid=add-dish-form]"));
  }

  async function openEditDishForm(sectionTitle: string, dishName: string) {
    const section = await adminSection(driver, sectionTitle);
    await (await adminDish(section, dishName)).findElement(By.css("[data-testid=edit-dish]")).click();
    return section.findElement(By.css("[data-testid=edit-dish-form]"));
  }

  async function formError(form: import("selenium-webdriver").WebElement): Promise<string> {
    const error = await driver.wait(until.elementIsVisible(await waitForChild(form, "[data-testid=form-error]")), 10_000);
    return error.getText();
  }

  async function waitForChild(parent: import("selenium-webdriver").WebElement, css: string) {
    return waitUntil(
      driver,
      async () => (await parent.findElements(By.css(css)))[0],
      `element ${css} did not appear`,
    );
  }

  async function adminDishNames(sectionTitle: string): Promise<string[]> {
    const section = await adminSection(driver, sectionTitle);
    const names = await section.findElements(By.css("[data-testid=admin-dish-name]"));
    return Promise.all(names.map((name) => name.getText()));
  }

  it("PIA1: el administrador añade una sección y se ve en la carta con el mensaje de sección vacía", async () => {
    await openAdmin(driver);
    await submitNewSection("Entrantes");
    await adminSection(driver, "Entrantes");

    await openMenu(driver);
    expect(await readMenu(driver)).toEqual([{ title: "Entrantes", dishes: [], emptyMessage: "Work In Progress..." }]);
  });

  it("PIA2: añadir una sección con un nombre existente muestra un error", async () => {
    await seedSection("Ramen");
    await openAdmin(driver);
    await submitNewSection("Ramen");

    const form = await driver.findElement(By.css("[data-testid=new-section-form]"));
    expect(await formError(form)).toBe("Ya existe una sección con ese nombre en la carta.");
    expect((await getMenu()).sections.map((s) => s.title)).toEqual(["Ramen"]);
  });

  it("PIA3: eliminar una sección con platos borra la sección y sus platos de la carta", async () => {
    await seedSection("Ramen", RAMEN);
    await seedSection("Bebidas", [{ name: "Agua", price: 2 }]);
    await openAdmin(driver);

    const section = await adminSection(driver, "Ramen");
    await section.findElement(By.css("[data-testid=delete-section]")).click();
    const dialog = await waitFor(driver, "[data-testid=confirm-dialog]");
    expect(await dialog.getText()).toContain('¿Eliminar la sección "Ramen" y todos sus platos?');
    await dialog.findElement(By.css("[data-testid=confirm-accept]")).click();
    await driver.wait(until.stalenessOf(section), 10_000);

    await openMenu(driver);
    const menu = await readMenu(driver);
    expect(menu.map((s) => s.title)).toEqual(["Bebidas"]);
    expect(menu.flatMap((s) => s.dishes.map((d) => d.name))).toEqual(["Agua"]);
    expect((await getMenu()).sections.flatMap((s) => s.dishes)).toHaveLength(1);
  });

  it("PIA4: editar el título de una sección conserva sus platos", async () => {
    await seedSection("Ramen", RAMEN);
    await openAdmin(driver);

    const section = await adminSection(driver, "Ramen");
    await section.findElement(By.css("[data-testid=edit-section]")).click();
    const form = await section.findElement(By.css("[data-testid=edit-section-form]"));
    await fill(form, "input[name=title]", "Ramen tradicional");
    await form.findElement(By.css("button[type=submit]")).click();
    await adminSection(driver, "Ramen tradicional");

    await openMenu(driver);
    expect(await readMenu(driver)).toEqual([
      {
        title: "Ramen tradicional",
        dishes: RAMEN.map((dish) => ({ name: dish.name, spicy: false })),
        emptyMessage: null,
      },
    ]);
  });

  it("PIA5: eliminar un plato, añadir otro y renombrar un tercero se refleja en la carta", async () => {
    await seedSection("Ramen", RAMEN);
    await openAdmin(driver);

    // Eliminar "Miso"
    const section = await adminSection(driver, "Ramen");
    await (await adminDish(section, "Miso")).findElement(By.css("[data-testid=delete-dish]")).click();
    await waitUntil(driver, async () => !(await adminDishNames("Ramen")).includes("Miso"), "Miso was not deleted");

    // Añadir "Tantanmen"
    const addForm = await openAddDishForm("Ramen");
    await fill(addForm, "input[name=name]", "Tantanmen");
    await fill(addForm, "textarea[name=description]", "Con sésamo y guindilla");
    await fill(addForm, "input[name=price]", "14.5");
    await addForm.findElement(By.css("button[type=submit]")).click();
    await waitUntil(driver, async () => (await adminDishNames("Ramen")).includes("Tantanmen"), "Tantanmen was not added");

    // Renombrar "Tonkotsu"
    const editForm = await openEditDishForm("Ramen", "Tonkotsu");
    await fill(editForm, "input[name=name]", "Tonkotsu especial");
    await editForm.findElement(By.css("button[type=submit]")).click();
    await waitUntil(
      driver,
      async () => (await adminDishNames("Ramen")).includes("Tonkotsu especial"),
      "Tonkotsu was not renamed",
    );

    await openMenu(driver);
    const [ramen] = await readMenu(driver);
    expect(ramen.dishes.map((d) => d.name)).toEqual(["Shoyu", "Tonkotsu especial", "Tantanmen"]);
  });

  it("PIA6: renombrar un plato con un nombre existente muestra un error y no cambia la carta", async () => {
    await seedSection("Ramen", RAMEN);
    const before = await getMenu();
    await openAdmin(driver);

    const form = await openEditDishForm("Ramen", "Miso");
    await fill(form, "input[name=name]", "Shoyu");
    await form.findElement(By.css("button[type=submit]")).click();

    expect(await formError(form)).toBe("Ya existe un plato con ese nombre en esta sección.");
    expect(await getMenu()).toEqual(before);
  });

  it("PIA7: añadir un plato con un nombre existente muestra un error y no cambia la carta", async () => {
    await seedSection("Ramen", RAMEN);
    const before = await getMenu();
    await openAdmin(driver);

    const form = await openAddDishForm("Ramen");
    await fill(form, "input[name=name]", "Shoyu");
    await fill(form, "input[name=price]", "9");
    await form.findElement(By.css("button[type=submit]")).click();

    expect(await formError(form)).toBe("Ya existe un plato con ese nombre en esta sección.");
    expect(await getMenu()).toEqual(before);
  });

  it("PIA8: marcar un plato como picante muestra la guindilla en la carta", async () => {
    await seedSection("Ramen", RAMEN);
    await openAdmin(driver);

    const form = await openEditDishForm("Ramen", "Miso");
    await form.findElement(By.css("input[name=isSpicy]")).click();
    await form.findElement(By.css("button[type=submit]")).click();
    await driver.wait(until.stalenessOf(form), 10_000);

    await openMenu(driver);
    const [ramen] = await readMenu(driver);
    expect(ramen.dishes).toEqual([
      { name: "Shoyu", spicy: false },
      { name: "Miso", spicy: true },
      { name: "Tonkotsu", spicy: false },
    ]);
  });
});
