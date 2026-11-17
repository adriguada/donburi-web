import { MAX_SPICINESS } from "../../shared/types";
import { spicinessLabel } from "../format";

/** One hot pepper per spiciness level (CL1.2.2). Renders nothing for 0. */
export function SpicyIcon({ level }: { level: number }) {
  if (level <= 0) return null;
  const label = `Picante: ${spicinessLabel(level)} de ${MAX_SPICINESS}`;
  return (
    <span className="spicy" role="img" aria-label={label} title={label} data-testid="spicy-icon" data-level={level}>
      {"🌶️".repeat(level)}
    </span>
  );
}
