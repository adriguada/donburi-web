import logoUrl from "../assets/donburi-logo.svg";
import lightCompactLogoUrl from "../assets/donburi-logo-light-compact.svg";
import lightLogoUrl from "../assets/donburi-logo-light.svg";
import { restaurant } from "../config";

interface Props {
  /** "light": kanji in the app's light colour, for the terracotta menu header. */
  variant?: "default" | "light";
  /** Only the bowl, without the "DONBURI RAMEN" lettering underneath (light variant only). */
  compact?: boolean;
}

export function Logo({ variant = "default", compact = false }: Props) {
  const src = variant === "light" ? (compact ? lightCompactLogoUrl : lightLogoUrl) : logoUrl;
  return <img className="logo" src={src} alt={`Logo de ${restaurant.name}`} data-compact={compact} />;
}
