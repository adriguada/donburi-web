import { useState } from "react";
import type { Section } from "../../../shared/types";
import { api, errorMessage } from "../../api";
import { formatPrice } from "../../format";
import { SpicyIcon } from "../SpicyIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { DishForm } from "./DishForm";
import { TitleForm } from "./TitleForm";

interface Props {
  section: Section;
  /** Reloads the menu after a successful change. */
  onChanged: () => Promise<void>;
}

export function AdminSection({ section, onChanged }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="admin-section card" data-testid="admin-section" aria-label={section.title}>
      {editingTitle ? (
        <TitleForm
          label="Nombre de la sección"
          submitLabel="Guardar"
          initialTitle={section.title}
          testId="edit-section-form"
          onCancel={() => setEditingTitle(false)}
          onSubmit={async (title) => {
            await api.updateSection(section.id, { title });
            setEditingTitle(false);
            await onChanged();
          }}
        />
      ) : (
        <div className="admin-section-header">
          <h2 data-testid="admin-section-title">{section.title}</h2>
          <div className="actions">
            <button type="button" onClick={() => setEditingTitle(true)} data-testid="edit-section">
              Editar nombre
            </button>
            <button type="button" className="danger" onClick={() => setConfirmingDelete(true)} data-testid="delete-section">
              Eliminar sección
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert" data-testid="section-error">
          {error}
        </p>
      )}

      {section.dishes.length === 0 ? (
        <p className="muted">Esta sección no tiene platos.</p>
      ) : (
        <ul className="admin-dish-list">
          {section.dishes.map((dish) =>
            editingDishId === dish.id ? (
              <li key={dish.id} className="admin-dish editing">
                <DishForm
                  dish={dish}
                  submitLabel="Guardar"
                  testId="edit-dish-form"
                  onCancel={() => setEditingDishId(null)}
                  onSubmit={async (input) => {
                    await api.updateDish(dish.id, input);
                    setEditingDishId(null);
                    await onChanged();
                  }}
                />
              </li>
            ) : (
              <li key={dish.id} className="admin-dish" data-testid="admin-dish">
                <div className="admin-dish-info">
                  <span className="dish-name" data-testid="admin-dish-name">
                    {dish.name}
                  </span>
                  {dish.isSpicy && <SpicyIcon />}
                  <span className="dish-price">{formatPrice(dish.price)}</span>
                  {dish.description && <p className="dish-description">{dish.description}</p>}
                </div>
                <div className="actions">
                  <button type="button" onClick={() => setEditingDishId(dish.id)} data-testid="edit-dish">
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => run(() => api.deleteDish(dish.id))}
                    data-testid="delete-dish"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <details className="add-dish">
        <summary>Añadir plato</summary>
        <DishForm
          submitLabel="Añadir plato"
          testId="add-dish-form"
          onSubmit={async (input) => {
            await api.createDish({ ...input, sectionId: section.id });
            await onChanged();
          }}
        />
      </details>

      {confirmingDelete && (
        <ConfirmDialog
          message={`¿Eliminar la sección "${section.title}" y todos sus platos? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            void run(() => api.deleteSection(section.id));
          }}
        />
      )}
    </section>
  );
}
