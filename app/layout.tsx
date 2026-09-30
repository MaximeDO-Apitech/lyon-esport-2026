import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lyon e-Sport 2026 — Écran d’attente",
  description: "Source navigateur animée pour la régie Lyon e-Sport 2026.",
  icons: {
    icon: "/assets/Bloc_marque_sans-fond_blanc.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
