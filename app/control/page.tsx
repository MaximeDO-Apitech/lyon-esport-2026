import type { Metadata } from "next";
import { ControlPanel } from "./panel";

export const metadata: Metadata = {
  title: "Contrôle régie — Lyon e-Sport 2026",
  description: "Prépare l’URL de la source navigateur vMix.",
};

export default function ControlPage() {
  return <ControlPanel />;
}
