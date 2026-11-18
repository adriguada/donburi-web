import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Menu } from "../../shared/types";
import { links, restaurant } from "../../src/config";
import { MenuPage } from "../../src/pages/MenuPage";
import { mockFetch } from "./fetch-mock";

const menu: Menu = {
  sections: [
    {
      id: 1,
      title: "Ramen",
      titleJa: "ラーメン",
      dishes: [
        { id: 1, sectionId: 1, name: "Tonkotsu", description: "Caldo de cerdo cremoso", price: 13.5, spiciness: 0 },
        { id: 2, sectionId: 1, name: "Tantanmen", description: null, price: 14, spiciness: 2 },
      ],
    },
    { id: 2, title: "Postres", titleJa: null, dishes: [] },
  ],
};

function renderWithMenu(data: Menu) {
  mockFetch({ "GET /api/menu": () => ({ status: 200, body: data }) });
  return render(<MenuPage />);
}

describe("MenuPage", () => {
  it("shows the restaurant logo (CL1.1)", async () => {
    renderWithMenu(menu);
    expect(screen.getByRole("img", { name: /logo de donburi/i })).toBeInTheDocument();
    await screen.findByText("Tonkotsu");
  });

  it("shows a centered Work In Progress message for an empty menu (CL1.5)", async () => {
    renderWithMenu({ sections: [] });
    const message = await screen.findByTestId("menu-empty");
    expect(message).toHaveTextContent("Work In Progress...");
    expect(message).toHaveClass("wip-menu");
    expect(screen.queryByTestId("menu-section")).not.toBeInTheDocument();
  });

  it("shows sections with their dishes' name, description and price (CL1.2, CL1.2.1, CL1.2.3)", async () => {
    renderWithMenu(menu);
    const ramen = await screen.findByRole("region", { name: "Ramen" });
    const dishes = within(ramen).getAllByTestId("dish");
    expect(dishes).toHaveLength(2);
    expect(dishes[0]).toHaveTextContent("Tonkotsu");
    expect(dishes[0]).toHaveTextContent("Caldo de cerdo cremoso");
    expect(within(dishes[0]).getByTestId("dish-price").textContent).toMatch(/13,50\s€/);
    expect(within(dishes[1]).queryByTestId("dish-description")).not.toBeInTheDocument();
  });

  it("shows as many chili icons as the dish spiciness, none for 0 (CL1.2.2)", async () => {
    renderWithMenu(menu);
    const dishes = await screen.findAllByTestId("dish");
    expect(within(dishes[0]).queryByRole("img", { name: /picante/i })).not.toBeInTheDocument();
    const peppers = within(dishes[1]).getByRole("img", { name: "Picante: 2 guindillas de 3" });
    expect(peppers.textContent).toBe("🌶️🌶️");
  });

  it("shows Work In Progress in an empty section (CL1.2.5)", async () => {
    renderWithMenu(menu);
    const desserts = await screen.findByRole("region", { name: "Postres" });
    expect(within(desserts).getByTestId("section-empty")).toHaveTextContent("Work In Progress...");
  });

  it("lets the customer collapse and expand a section (CL1.2.4)", async () => {
    const user = userEvent.setup();
    renderWithMenu(menu);
    const toggle = await screen.findByRole("button", { name: /^Ramen/ });
    const icon = () => within(toggle).getByTestId("section-toggle-icon");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(icon()).toHaveAttribute("data-state", "expanded"); // '−' icon
    expect(screen.getByText("Tonkotsu")).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(icon()).toHaveAttribute("data-state", "collapsed"); // '+' icon
    expect(screen.getByText("Tonkotsu")).not.toBeVisible();
    // The content stays mounted so the height can animate (smooth transition).
    const content = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(content).toHaveAttribute("data-expanded", "false");
    expect(content).toHaveAttribute("inert");

    await user.click(toggle);
    expect(screen.getByText("Tonkotsu")).toBeVisible();
  });

  it("places the −/+ icon before the section title (Diseño de interfaz)", async () => {
    renderWithMenu(menu);
    const toggle = await screen.findByRole("button", { name: /^Ramen/ });
    expect(toggle.firstElementChild).toHaveAttribute("data-testid", "section-toggle-icon");
  });

  it("shows the Japanese title under the section title, only when it has one (CL1.2.6)", async () => {
    renderWithMenu(menu);
    const ramen = await screen.findByRole("region", { name: "Ramen" });
    const titles = within(ramen).getByTestId("section-title").parentElement!;
    expect(titles.children[0]).toHaveTextContent("Ramen");
    expect(titles.children[1]).toHaveTextContent("ラーメン");
    expect(titles.children[1]).toHaveAttribute("lang", "ja");

    const desserts = screen.getByRole("region", { name: "Postres" });
    expect(within(desserts).queryByTestId("section-title-ja")).not.toBeInTheDocument();
  });

  it("shows address, phone, WhatsApp and Instagram in the footer (CL1.3)", async () => {
    renderWithMenu(menu);
    await screen.findByText("Tonkotsu");
    const footer = screen.getByTestId("footer");
    expect(within(footer).getByText(restaurant.address)).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: restaurant.phone })).toHaveAttribute("href", links.phone);
    expect(within(footer).getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", links.whatsapp);
    const instagram = within(footer).getByRole("link", { name: /instagram/i });
    expect(instagram).toHaveAttribute("href", `https://www.instagram.com/${restaurant.instagramHandle}/`);
    expect(instagram).toHaveAttribute("target", "_blank");
  });

  it("builds tel: and wa.me links from the configured phone number", () => {
    const digits = restaurant.phone.replace(/\D/g, "");
    expect(links.phone).toBe(`tel:+${digits}`);
    expect(links.whatsapp).toBe(`https://wa.me/${digits}`);
  });

  it("shows WhatsApp and Instagram as app icons (Diseño de interfaz)", async () => {
    renderWithMenu(menu);
    await screen.findByText("Tonkotsu");
    for (const name of [/whatsapp/i, /instagram/i]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveTextContent("");
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("hides the logo while scrolling down and shows it again when scrolling up (Diseño de interfaz)", async () => {
    renderWithMenu(menu);
    await screen.findByText("Tonkotsu");
    const header = screen.getByTestId("menu-header");
    const scrollTo = (y: number) => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      fireEvent.scroll(window);
    };
    const logo = () => within(header).getByRole("img", { name: /logo de donburi/i });
    expect(header).toHaveAttribute("data-visible", "true");
    expect(header).toHaveAttribute("data-compact", "false"); // full header at the top
    expect(logo()).toHaveAttribute("data-compact", "false");

    scrollTo(300);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "false"));
    expect(header).toHaveClass("menu-header-hidden");

    scrollTo(303); // tiny movements are ignored
    scrollTo(150);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "true"));
    expect(header).not.toHaveClass("menu-header-hidden");
    // Reappearing mid-page: smaller header, logo without the lettering.
    expect(header).toHaveAttribute("data-compact", "true");
    expect(header).toHaveClass("menu-header-compact");
    expect(logo()).toHaveAttribute("data-compact", "true");
    expect(logo().getAttribute("src")).toMatch(/compact/);

    scrollTo(600);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "false"));
    scrollTo(0);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "true"));
    expect(header).toHaveAttribute("data-compact", "false"); // back to the full header at the top
    expect(logo().getAttribute("src")).not.toMatch(/compact/);
  });

  it("opens on the header and an illustration, with a 'Carta' arrow leading down to the menu (Diseño de interfaz)", async () => {
    renderWithMenu(menu);
    await screen.findByText("Tonkotsu");
    const hero = screen.getByTestId("hero");
    // The hero comes right after the header and before the menu.
    expect(screen.getByTestId("menu-header").nextElementSibling).toBe(hero);
    expect(within(hero).getByRole("img", { name: /gato negro comiendo ramen/i })).toBeInTheDocument();
    const link = within(hero).getByRole("link", { name: "Carta" });
    expect(link).toHaveAttribute("href", "#carta");
    expect(link.querySelector("svg")).not.toBeNull(); // the down chevron
    expect(document.getElementById("carta")).toContainElement(screen.getByText("Tonkotsu"));
  });

  it("shows an error when the menu cannot be loaded", async () => {
    mockFetch({ "GET /api/menu": () => ({ status: 500, body: { error: "NOT_FOUND", message: "Fallo" } }) });
    render(<MenuPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido cargar la carta. Fallo");
  });
});
