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
      dishes: [
        { id: 1, sectionId: 1, name: "Tonkotsu", description: "Caldo de cerdo cremoso", price: 13.5, isSpicy: false },
        { id: 2, sectionId: 1, name: "Tantanmen", description: null, price: 14, isSpicy: true },
      ],
    },
    { id: 2, title: "Postres", dishes: [] },
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

  it("marks only spicy dishes with the chili icon (CL1.2.2)", async () => {
    renderWithMenu(menu);
    const dishes = await screen.findAllByTestId("dish");
    expect(within(dishes[0]).queryByRole("img", { name: "Picante" })).not.toBeInTheDocument();
    expect(within(dishes[1]).getByRole("img", { name: "Picante" })).toBeInTheDocument();
  });

  it("shows Work In Progress in an empty section (CL1.2.5)", async () => {
    renderWithMenu(menu);
    const desserts = await screen.findByRole("region", { name: "Postres" });
    expect(within(desserts).getByTestId("section-empty")).toHaveTextContent("Work In Progress...");
  });

  it("lets the customer collapse and expand a section (CL1.2.4)", async () => {
    const user = userEvent.setup();
    renderWithMenu(menu);
    const toggle = await screen.findByRole("button", { name: "Ramen" });
    const icon = () => within(toggle).getByTestId("section-toggle-icon");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(icon()).toHaveAttribute("data-state", "expanded"); // '−' icon
    expect(screen.getByText("Tonkotsu")).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(icon()).toHaveAttribute("data-state", "collapsed"); // '+' icon
    expect(screen.getByText("Tonkotsu")).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByText("Tonkotsu")).toBeVisible();
  });

  it("places the −/+ icon before the section title (Diseño de interfaz)", async () => {
    renderWithMenu(menu);
    const toggle = await screen.findByRole("button", { name: "Ramen" });
    expect(toggle.firstElementChild).toHaveAttribute("data-testid", "section-toggle-icon");
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
    expect(header).toHaveAttribute("data-visible", "true");

    scrollTo(300);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "false"));
    expect(header).toHaveClass("menu-header-hidden");

    scrollTo(303); // tiny movements are ignored
    scrollTo(150);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "true"));
    expect(header).not.toHaveClass("menu-header-hidden");

    scrollTo(600);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "false"));
    scrollTo(0);
    await waitFor(() => expect(header).toHaveAttribute("data-visible", "true"));
  });

  it("shows an error when the menu cannot be loaded", async () => {
    mockFetch({ "GET /api/menu": () => ({ status: 500, body: { error: "NOT_FOUND", message: "Fallo" } }) });
    render(<MenuPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido cargar la carta. Fallo");
  });
});
