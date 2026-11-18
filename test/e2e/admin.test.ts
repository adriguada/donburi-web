// Selenium integration tests for the admin panel: PIA1–PIA8 in requirements.md.
import { Origin, By, until, type WebDriver } from "selenium-webdriver";
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

  async function submitNewSection(title: string, titleJa?: string) {
    const form = await waitFor(driver, "[data-testid=new-section-form]");
    await fill(form, "input[name=title]", title);
    if (titleJa) await fill(form, "input[name=titleJa]", titleJa);
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

  it("CL1.2.6: una sección creada con nombre en japonés lo muestra centrado bajo el título en la carta", async () => {
    await openAdmin(driver);
    await submitNewSection("Ramen", "ラーメン");
    await adminSection(driver, "Ramen");

    await openMenu(driver);
    const section = await waitFor(driver, "[data-testid=menu-section]");
    const ja = await section.findElement(By.css("[data-testid=section-title-ja]"));
    expect(await ja.getText()).toBe("ラーメン");
    const layout = await driver.executeScript<{ title: number; ja: number; centre: number; jaBelow: boolean }>(
      `const s = arguments[0].getBoundingClientRect();
       const t = arguments[0].querySelector("[data-testid=section-title]").getBoundingClientRect();
       const j = arguments[0].querySelector("[data-testid=section-title-ja]").getBoundingClientRect();
       return { title: t.left + t.width / 2, ja: j.left + j.width / 2, centre: s.left + s.width / 2, jaBelow: j.top >= t.bottom - 1 };`,
      section,
    );
    expect(Math.abs(layout.title - layout.centre)).toBeLessThan(2);
    expect(Math.abs(layout.ja - layout.centre)).toBeLessThan(2);
    expect(layout.jaBelow).toBe(true);
    // Rendered with Shippori Mincho's Japanese glyphs, not a fallback font.
    expect(await driver.executeScript("return document.fonts.check('16px \"Shippori Mincho\"', 'ラーメン')")).toBe(true);
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
        dishes: RAMEN.map((dish) => ({ name: dish.name, peppers: 0 })),
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

  it("PIA8: asignar un nivel de picante a un plato muestra ese número de guindillas en la carta", async () => {
    await seedSection("Ramen", RAMEN);
    await openAdmin(driver);

    const form = await openEditDishForm("Ramen", "Miso");
    await form.findElement(By.css("[data-testid=spiciness-option-2]")).click();
    await form.findElement(By.css("button[type=submit]")).click();
    await driver.wait(until.stalenessOf(form), 10_000);

    await openMenu(driver);
    const [ramen] = await readMenu(driver);
    expect(ramen.dishes).toEqual([
      { name: "Shoyu", peppers: 0 },
      { name: "Miso", peppers: 2 },
      { name: "Tonkotsu", peppers: 0 },
    ]);
  });

  it("AD1.1.4.1: el administrador arrastra una sección para cambiar su orden en la carta", async () => {
    await seedSection("Entrantes", [{ name: "Gyozas", price: 6 }]);
    await seedSection("Ramen", RAMEN);
    await seedSection("Postres");
    await openAdmin(driver);

    // Drag "Postres" by its handle above "Entrantes", moving in small steps like a real pointer.
    const handle = await (await adminSection(driver, "Postres")).findElement(By.css("[data-testid=drag-section]"));
    const target = await (await adminSection(driver, "Entrantes")).findElement(By.css("[data-testid=drag-section]"));
    const from = await handle.getRect();
    const to = await target.getRect();
    const dy = Math.round(to.y - from.y - 20);
    let actions = driver.actions({ async: true }).move({ origin: handle }).press();
    for (let step = 1; step <= 10; step++) {
      actions = actions.move({ origin: Origin.POINTER, x: 0, y: Math.round(dy / 10), duration: 50 });
    }
    await actions.release().perform();

    const sectionTitles = async () => {
      const titles = await driver.findElements(By.css("[data-testid=admin-section-title]"));
      return Promise.all(titles.map((title) => title.getText()));
    };
    await waitUntil(
      driver,
      async () => JSON.stringify(await sectionTitles()) === JSON.stringify(["Postres", "Entrantes", "Ramen"]),
      "sections were not reordered in the admin panel",
    );
    await waitUntil(
      driver,
      async () => (await getMenu()).sections.map((section) => section.title).join() === "Postres,Entrantes,Ramen",
      "new order was not saved",
    );

    await openMenu(driver);
    const menu = await readMenu(driver);
    expect(menu.map((section) => section.title)).toEqual(["Postres", "Entrantes", "Ramen"]);
    expect(menu[2].dishes.map((dish) => dish.name)).toEqual(RAMEN.map((dish) => dish.name));
  });
});
