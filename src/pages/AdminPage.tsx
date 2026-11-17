import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";
import type { Menu } from "../../shared/types";
import { api, errorMessage } from "../api";
import { AdminSection } from "../components/admin/AdminSection";
import { TitleForm } from "../components/admin/TitleForm";
import { Logo } from "../components/Logo";

const announcements = {
  onDragStart: () => "Sección seleccionada. Usa las flechas para moverla y Espacio para soltarla.",
  onDragOver: () => "Sección movida.",
  onDragEnd: () => "Sección colocada.",
  onDragCancel: () => "Movimiento cancelado.",
};

export function AdminPage() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const sensors = useSensors(
    // A small distance threshold so taps and clicks on the handle don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reload = useCallback(async () => {
    try {
      setMenu(await api.getMenu());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getMenu()
      .then((loaded) => !cancelled && setMenu(loaded))
      .catch((error: unknown) => !cancelled && setLoadError(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, []);

  /** AD1.2: reorders sections optimistically, then saves; reverts on failure. */
  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!menu || !over || active.id === over.id) return;
    const from = menu.sections.findIndex((section) => section.id === active.id);
    const to = menu.sections.findIndex((section) => section.id === over.id);
    const previous = menu;
    const sections = arrayMove(menu.sections, from, to);
    setMenu({ sections });
    setOrderError(null);
    try {
      setMenu(await api.reorderSections(sections.map((section) => section.id)));
    } catch (error) {
      setMenu(previous);
      setOrderError(errorMessage(error));
    }
  }

  return (
    <div className="page admin-page">
      <header className="admin-header">
        <Logo />
        <div>
          <h1>Administración de la carta</h1>
          <a href="/">Ver la carta</a>
        </div>
      </header>
      <main>
        <div className="card">
          <TitleForm
            label="Nueva sección"
            submitLabel="Añadir sección"
            testId="new-section-form"
            onSubmit={async (title) => {
              await api.createSection({ title });
              await reload();
            }}
          />
        </div>

        {loadError && (
          <p className="status error" role="alert">
            No se ha podido cargar la carta. {loadError}
          </p>
        )}
        {orderError && (
          <p className="form-error" role="alert" data-testid="order-error">
            {orderError}
          </p>
        )}
        {menu === null && !loadError && <p className="status">Cargando…</p>}
        {menu?.sections.length === 0 && <p className="muted">La carta no tiene secciones todavía.</p>}
        {menu && menu.sections.length > 1 && (
          <p className="muted hint">Arrastra las secciones por el asa para cambiar su orden en la carta.</p>
        )}
        {menu && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: "Pulsa Espacio para mover la sección." } }}
          >
            <SortableContext items={menu.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
              {menu.sections.map((section) => (
                <AdminSection key={section.id} section={section} onChanged={reload} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}
