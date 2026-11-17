import { useId, useState } from "react";
import type { Section } from "../../shared/types";
import { formatPrice } from "../format";
import { MinusIcon, PlusIcon } from "./icons";
import { SpicyIcon } from "./SpicyIcon";

export const WIP_MESSAGE = "Work In Progress...";

export function MenuSection({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();

  return (
    <section className="menu-section" data-testid="menu-section" aria-label={section.title}>
      <h2 className="menu-section-heading">
        <button
          type="button"
          className="menu-section-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="toggle-icon" data-testid="section-toggle-icon" data-state={expanded ? "expanded" : "collapsed"}>
            {expanded ? <MinusIcon /> : <PlusIcon />}
          </span>
          <span>{section.title}</span>
        </button>
      </h2>
      {/* Collapsing animates the row height from 1fr to 0fr (smooth transition);
          visibility hides the content from assistive tech once collapsed. */}
      <div
        id={contentId}
        className="section-content"
        data-expanded={expanded}
        inert={!expanded}
        style={expanded ? undefined : { visibility: "hidden" }}
      >
        <div className="section-content-inner">
          {section.dishes.length === 0 ? (
            <p className="wip" data-testid="section-empty">
              {WIP_MESSAGE}
            </p>
          ) : (
            <ul className="dish-list">
              {section.dishes.map((dish) => (
                <li key={dish.id} className="dish" data-testid="dish">
                  <div className="dish-line">
                    <span className="dish-name" data-testid="dish-name">
                      {dish.name}
                    </span>
                    <SpicyIcon level={dish.spiciness} />
                    <span className="dish-rule" aria-hidden="true" />
                    <span className="dish-price" data-testid="dish-price">
                      {formatPrice(dish.price)}
                    </span>
                  </div>
                  {dish.description && (
                    <p className="dish-description" data-testid="dish-description">
                      {dish.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
