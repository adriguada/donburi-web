// Selenium integration tests for the public menu: PIC1–PIC3 in requirements.md.
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { restaurant } from "../../src/config";
import { createDriver, openMenu, readMenu, resetMenu, seedSection, waitFor, waitUntil } from "./helpers";

describe("Carta pública (PIC)", () => {
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

  it("PIC1: un cliente ve la carta vacía con el mensaje de carta vacía", async () => {
    await openMenu(driver);
    const message = await waitFor(driver, "[data-testid=menu-empty]");
    expect(await message.getText()).toBe("Work In Progress...");
    expect(await driver.findElements(By.css("[data-testid=menu-section]"))).toHaveLength(0);
  });

  it("PIC2: un cliente ve una sección con tres platos y una sección vacía con su mensaje", async () => {
    await seedSection("Ramen", [
      { name: "Shoyu", description: "Caldo de soja", price: 12 },
      { name: "Miso", price: 12.5 },
      { name: "Tantanmen", price: 14, spiciness: 3 },
    ]);
    await seedSection("Postres");

    await openMenu(driver);
    expect(await readMenu(driver)).toEqual([
      {
        title: "Ramen",
        dishes: [
          { name: "Shoyu", peppers: 0 },
          { name: "Miso", peppers: 0 },
          { name: "Tantanmen", peppers: 3 },
        ],
        emptyMessage: null,
      },
      { title: "Postres", dishes: [], emptyMessage: "Work In Progress..." },
    ]);
    expect(await driver.findElements(By.css("[data-testid=menu-empty]"))).toHaveLength(0);
  });

  it("PIC3: el enlace de Instagram lleva al perfil del restaurante", async () => {
    await openMenu(driver);
    const link = await waitFor(driver, "[data-testid=instagram-link]");
    const expected = `https://www.instagram.com/${restaurant.instagramHandle}/`;
    expect(await link.getAttribute("href")).toBe(expected);

    const original = await driver.getWindowHandle();
    await link.click();
    const newHandle = await waitUntil(
      driver,
      async () => (await driver.getAllWindowHandles()).find((handle) => handle !== original),
      "Instagram did not open in a new tab",
    );
    await driver.switchTo().window(newHandle!);
    // The browser navigates to the profile URL (it may redirect within instagram.com).
    const url = await waitUntil(
      driver,
      async () => {
        const current = await driver.getCurrentUrl();
        return current.includes("instagram.com") ? current : false;
      },
      "new tab did not navigate to Instagram",
    );
    expect(url).toContain("instagram.com");
    await driver.close();
    await driver.switchTo().window(original);
  });

  it("Diseño: el logo se desvanece al bajar por la página y reaparece al subir", async () => {
    const dishes = Array.from({ length: 12 }, (_, i) => ({ name: `Plato ${i + 1}`, description: "Descripción", price: 10 }));
    await seedSection("Ramen", dishes);
    await seedSection("Bebidas", dishes);
    await openMenu(driver);
    const header = await waitFor(driver, "[data-testid=menu-header]");
    const headerState = async () => ({
      visible: await header.getAttribute("data-visible"),
      opacity: Number(await header.getCssValue("opacity")),
    });

    await driver.executeScript("window.scrollTo(0, 600)");
    await waitUntil(driver, async () => (await headerState()).opacity === 0, "logo did not fade out on scroll down");
    expect(await headerState()).toEqual({ visible: "false", opacity: 0 });

    await driver.executeScript("window.scrollBy(0, -200)");
    await waitUntil(driver, async () => (await headerState()).opacity === 1, "logo did not reappear on scroll up");
    expect((await headerState()).visible).toBe("true");
    // It reappears at the top of the viewport (sticky), not only at the top of the page.
    const top = await driver.executeScript<number>("return arguments[0].getBoundingClientRect().top", header);
    expect(Math.abs(top)).toBeLessThan(5);

    // Mid-page it comes back smaller, with the bowl-only logo (no lettering).
    const frameSize = () =>
      driver.executeScript<number>("return document.querySelector('.menu-header-inner').getBoundingClientRect().width");
    const fullSize = await driver.executeScript<number>(
      "return parseFloat(getComputedStyle(document.querySelector('.menu-page')).getPropertyValue('--header-size'))",
    );
    await waitUntil(driver, async () => (await frameSize()) < fullSize * 0.6, "header did not shrink when reappearing");
    const logo = await header.findElement(By.css("img"));
    expect(await logo.getAttribute("data-compact")).toBe("true");
    // Shrinking the header must not move the page.
    const scrollBefore = await driver.executeScript<number>("return scrollY");
    expect(scrollBefore).toBe(400);

    // Back at the very top: full-size header with the lettering again.
    await driver.executeScript("window.scrollTo(0, 0)");
    await waitUntil(driver, async () => Math.round(await frameSize()) === fullSize, "header did not grow back at the top");
    expect(await logo.getAttribute("data-compact")).toBe("false");
  });

  it("Diseño: al abrir la carta se ven el header, la imagen y la flecha «Carta»; la carta empieza más abajo", async () => {
    // Long enough that the page can scroll the menu to the top of the screen.
    await seedSection("Ramen", Array.from({ length: 12 }, (_, i) => ({ name: `Plato ${i + 1}`, price: 10 })));
    await openMenu(driver);
    const layout = await driver.executeScript<{ vh: number; image: number; arrow: number; menu: number }>(`
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      return { vh: innerHeight, image: box(".hero-image img").height, arrow: box(".hero-scroll-arrow").bottom, menu: box("#carta").top };
    `);
    expect(layout.image).toBeGreaterThan(100);
    expect(layout.arrow).toBeLessThanOrEqual(layout.vh); // arrow visible on the first screen
    expect(layout.menu).toBeGreaterThanOrEqual(layout.vh); // menu below the fold
    const animation = await driver.executeScript<string>(
      "return getComputedStyle(document.querySelector('.hero-scroll-arrow')).animationName",
    );
    expect(animation).toBe("hero-nudge");

    await (await waitFor(driver, "[data-testid=scroll-to-menu]")).click();
    await waitUntil(
      driver,
      async () => (await driver.executeScript<number>("return document.querySelector('#carta').getBoundingClientRect().top")) < layout.vh / 2,
      "clicking «Carta» did not scroll to the menu",
    );
  });
});
