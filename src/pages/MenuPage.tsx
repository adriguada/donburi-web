import { useEffect, useState } from "react";
import type { Menu } from "../../shared/types";
import { api, errorMessage } from "../api";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { MenuSection, WIP_MESSAGE } from "../components/MenuSection";
import { useShowOnScrollUp } from "../hooks/useShowOnScrollUp";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; menu: Menu };

export function MenuPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const logoVisible = useShowOnScrollUp();

  useEffect(() => {
    let cancelled = false;
    api
      .getMenu()
      .then((menu) => !cancelled && setState({ status: "ready", menu }))
      .catch((error: unknown) => !cancelled && setState({ status: "error", message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="menu-page">
      <header
        className={`menu-header${logoVisible ? "" : " menu-header-hidden"}`}
        data-testid="menu-header"
        data-visible={logoVisible}
      >
        <div className="menu-header-inner">
          <Logo />
        </div>
      </header>
      <div className="page menu-body">
        <main className="menu-main">
          {state.status === "loading" && <p className="status">Cargando la carta…</p>}
          {state.status === "error" && (
            <p className="status error" role="alert">
              No se ha podido cargar la carta. {state.message}
            </p>
          )}
          {state.status === "ready" &&
            (state.menu.sections.length === 0 ? (
              <p className="wip wip-menu" data-testid="menu-empty">
                {WIP_MESSAGE}
              </p>
            ) : (
              state.menu.sections.map((section) => <MenuSection key={section.id} section={section} />)
            ))}
        </main>
        <Footer />
      </div>
    </div>
  );
}
