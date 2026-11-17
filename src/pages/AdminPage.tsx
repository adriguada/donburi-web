import { useCallback, useEffect, useState } from "react";
import type { Menu } from "../../shared/types";
import { api, errorMessage } from "../api";
import { AdminSection } from "../components/admin/AdminSection";
import { TitleForm } from "../components/admin/TitleForm";
import { Logo } from "../components/Logo";

export function AdminPage() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        {menu === null && !loadError && <p className="status">Cargando…</p>}
        {menu?.sections.length === 0 && <p className="muted">La carta no tiene secciones todavía.</p>}
        {menu?.sections.map((section) => (
          <AdminSection key={section.id} section={section} onChanged={reload} />
        ))}
      </main>
    </div>
  );
}
