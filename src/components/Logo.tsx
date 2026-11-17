import logoUrl from "../assets/donburi-logo.svg";
import lightLogoUrl from "../assets/donburi-logo-light.svg";
import { restaurant } from "../config";

interface Props {
  /** "light": kanji in the app's light colour, for the terracotta menu header. */
  variant?: "default" | "light";
}

export function Logo({ variant = "default" }: Props) {
  return (
    <img
      className="logo"
      src={variant === "light" ? lightLogoUrl : logoUrl}
      alt={`Logo de ${restaurant.name}`}
    />
  );
}
