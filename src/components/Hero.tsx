import type { MouseEvent } from "react";
import catUrl from "../assets/gato-donburi.svg";
import { ChevronDownIcon } from "./icons";

export const MENU_ANCHOR = "carta";

/** Smooth-scrolls to the menu (instant if the user prefers reduced motion). */
function scrollToMenu(event: MouseEvent<HTMLAnchorElement>) {
  const menu = document.getElementById(MENU_ANCHOR);
  if (!menu) return; // fall back to the plain #carta link
  event.preventDefault();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  menu.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/**
 * Opening screen of the menu: together with the header it fills the first
 * viewport, with an illustration in the centre and a bouncing "Carta" chevron
 * at the bottom inviting the customer to scroll down to the menu.
 */
export function Hero() {
  return (
    <section className="hero" data-testid="hero" aria-label="Bienvenida">
      <div className="hero-image">
        <img src={catUrl} alt="Gato negro comiendo ramen de un cuenco con «Donburi» escrito en japonés" />
      </div>
      <a className="hero-scroll" href={`#${MENU_ANCHOR}`} onClick={scrollToMenu} data-testid="scroll-to-menu">
        <span className="hero-scroll-label">Carta</span>
        <span className="hero-scroll-arrow">
          <ChevronDownIcon />
        </span>
      </a>
    </section>
  );
}
