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
      { name: "Tantanmen", price: 14, isSpicy: true },
    ]);
    await seedSection("Postres");

    await openMenu(driver);
    expect(await readMenu(driver)).toEqual([
      {
        title: "Ramen",
        dishes: [
          { name: "Shoyu", spicy: false },
          { name: "Miso", spicy: false },
          { name: "Tantanmen", spicy: true },
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
});
