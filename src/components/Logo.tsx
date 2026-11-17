import { restaurant } from "../config";

/** Placeholder logo (TODO: replace with the restaurant's real logo). */
export function Logo() {
  return (
    <div className="logo" role="img" aria-label={`Logo de ${restaurant.name}`}>
      <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill="var(--accent)" />
        <path d="M14 30h36a18 18 0 0 1-36 0z" fill="var(--paper)" />
        <path d="M24 12l10 16M30 10l8 18" stroke="var(--paper)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="logo-text">
        <span className="logo-name">DONBURI</span>
        <span className="logo-sub">Ramen Bar</span>
      </span>
    </div>
  );
}
