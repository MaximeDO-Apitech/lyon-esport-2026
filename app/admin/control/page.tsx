import type { Metadata } from "next";
import { ControlStudio } from "../../../components/admin/control-studio";

export const metadata: Metadata = {
  title: "Pupitre — LES Graphics Studio",
  description: "Préparation, prévisualisation et publication des graphismes Lyon e-Sport 2026.",
};

export default function AdminControlPage() {
  return <ControlStudio />;
}
