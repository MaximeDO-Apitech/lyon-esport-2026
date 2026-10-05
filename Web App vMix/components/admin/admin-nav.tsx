"use client";

/* eslint-disable @next/next/no-img-element -- the official logo is served byte-for-byte */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="admin-topbar">
      <Link className="admin-brand" href="/admin/control">
        <img src="/assets/Bloc_marque_sans-fond_blanc.png" alt="Lyon e-Sport" />
        <span><b>Graphics Studio</b><small>Canal stream</small></span>
      </Link>
      <nav aria-label="Navigation régie">
        <Link className={pathname === "/admin/control" ? "active" : ""} href="/admin/control">Pupitre</Link>
        <Link className={pathname === "/admin/library" ? "active" : ""} href="/admin/library">Bibliothèque</Link>
        <Link className={pathname === "/admin/status" ? "active" : ""} href="/admin/status">Statut</Link>
      </nav>
      <div className="admin-output-links">
        <a href="/output/attente" target="_blank" rel="noreferrer">Sortie attente</a>
        <a href="/output/synthe" target="_blank" rel="noreferrer">Sortie synthé</a>
        <a href="/output/replay-marker" target="_blank" rel="noreferrer">Sortie replay</a>
      </div>
    </header>
  );
}
