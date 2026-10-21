"use client";
import { Menu, X } from "lucide-react";
import { nav, type Tab } from "@/lib/navigation";

type AppHeaderProps = {
  tab: Tab;
  menu: boolean;
  setMenu: (open: boolean) => void;
  pendingCount: number;
  navigate: (tab: Tab) => void;
};
export function AppHeader({
  tab,
  menu,
  setMenu,
  pendingCount,
  navigate,
}: AppHeaderProps) {
  return (
    <header className="sidebar">
      <a
        className="logo"
        href="#overview"
        aria-label="Gogroup início"
        onClick={(e) => {
          e.preventDefault();
          navigate("overview");
        }}
      >
        <img src="/gogroup-logo.svg" alt="Gogroup" width={159} height={32} />
      </a>
      <span className="brand-product">Agente de operações</span>
      <button
        className="mobile-menu-toggle"
        aria-label={menu ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />} Menu
      </button>
      <nav className={menu ? "menu-open" : ""} aria-label="Navegação principal">
        {nav.map(([id, label]) => (
          <button
            className={`nav-item ${tab === id ? "active" : ""}`}
            aria-current={tab === id ? "page" : undefined}
            key={id}
            onClick={() => navigate(id)}
          >
            <span className="nav-item-label">
              {label}
              {id === "agent" && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </header>
  );
}
