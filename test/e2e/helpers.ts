import { existsSync } from "node:fs";
import { Builder, By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome.js";
import { inject } from "vitest";
import type { Menu } from "../../shared/types";

export const baseUrl = inject("baseUrl");
const TIMEOUT = 10_000;

/**
 * Headless Chromium. Set CHROME_BIN / CHROMEDRIVER_PATH to override the
 * binaries; otherwise the system ones are used if present, or Selenium
 * Manager downloads them.
 */
export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments("--headless=new", "--no-sandbox", "--window-size=430,1000");
  const chromeBin = process.env.CHROME_BIN ?? ["/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  if (chromeBin) options.setBinaryPath(chromeBin);

  const builder = new Builder().forBrowser("chrome").setChromeOptions(options);
  const driverPath = process.env.CHROMEDRIVER_PATH ?? (existsSync("/usr/bin/chromedriver") ? "/usr/bin/chromedriver" : undefined);
  if (driverPath) builder.setChromeService(new chrome.ServiceBuilder(driverPath));
  return builder.build();
}

// ---------- API helpers (seed / reset the local database) ----------

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const getMenu = () => apiCall<Menu>("GET", "/api/menu");

export async function resetMenu(): Promise<void> {
  for (const section of (await getMenu()).sections) {
    await apiCall("DELETE", `/api/section/${section.id}`);
  }
}

export interface SeedDish {
  name: string;
  description?: string;
  price?: number;
  isSpicy?: boolean;
}

export async function seedSection(title: string, dishes: SeedDish[] = []): Promise<number> {
  const section = await apiCall<{ id: number }>("POST", "/api/section", { title });
  for (const dish of dishes) {
    await apiCall("POST", "/api/dish", {
      sectionId: section.id,
      name: dish.name,
      description: dish.description ?? null,
      price: dish.price ?? 10,
      isSpicy: dish.isSpicy ?? false,
    });
  }
  return section.id;
}

// ---------- Page helpers ----------

export async function waitFor(driver: WebDriver, css: string): Promise<WebElement> {
  const element = await driver.wait(until.elementLocated(By.css(css)), TIMEOUT);
  await driver.wait(until.elementIsVisible(element), TIMEOUT);
  return element;
}

/** Waits until `condition` returns a truthy value (retrying on stale elements). */
export async function waitUntil<T>(driver: WebDriver, condition: () => Promise<T>, message: string): Promise<T> {
  return driver.wait(async () => {
    try {
      return await condition();
    } catch {
      return false as T;
    }
  }, TIMEOUT, message);
}

export interface RenderedSection {
  title: string;
  dishes: { name: string; spicy: boolean }[];
  emptyMessage: string | null;
}

/** Opens the public menu and waits for it to finish loading. */
export async function openMenu(driver: WebDriver): Promise<void> {
  await driver.get(`${baseUrl}/`);
  await waitFor(driver, "[data-testid=menu-empty], [data-testid=menu-section]");
}

export async function readMenu(driver: WebDriver): Promise<RenderedSection[]> {
  const result: RenderedSection[] = [];
  for (const section of await driver.findElements(By.css("[data-testid=menu-section]"))) {
    const title = await section.findElement(By.css(".menu-section-toggle")).getText();
    const dishes = [];
    for (const dish of await section.findElements(By.css("[data-testid=dish]"))) {
      dishes.push({
        name: await dish.findElement(By.css("[data-testid=dish-name]")).getText(),
        spicy: (await dish.findElements(By.css("[data-testid=spicy-icon]"))).length > 0,
      });
    }
    const empty = await section.findElements(By.css("[data-testid=section-empty]"));
    result.push({ title, dishes, emptyMessage: empty.length ? await empty[0].getText() : null });
  }
  return result;
}

export async function openAdmin(driver: WebDriver): Promise<void> {
  await driver.get(`${baseUrl}/admin/`);
  await waitFor(driver, "[data-testid=new-section-form]");
  await waitUntil(
    driver,
    async () => (await driver.findElements(By.css(".status"))).length === 0,
    "admin page did not finish loading",
  );
}

export async function adminSection(driver: WebDriver, title: string): Promise<WebElement> {
  return driver.wait(
    until.elementLocated(By.xpath(`//section[@data-testid='admin-section'][@aria-label='${title}']`)),
    TIMEOUT,
  );
}

export async function adminDish(section: WebElement, name: string): Promise<WebElement> {
  return section.findElement(
    By.xpath(`.//li[@data-testid='admin-dish'][.//span[@data-testid='admin-dish-name' and text()='${name}']]`),
  );
}

export async function fill(form: WebElement, css: string, value: string): Promise<void> {
  const input = await form.findElement(By.css(css));
  await input.clear();
  await input.sendKeys(value);
}
