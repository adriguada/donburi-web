import logoUrl from "../assets/donburi-logo.svg";
import { restaurant } from "../config";

export function Logo() {
  return <img className="logo" src={logoUrl} alt={`Logo de ${restaurant.name}`} />;
}
