import type { Metadata } from "next";
import { LibraryStudio } from "../../../components/admin/library-studio";

export const metadata: Metadata = {
  title: "Bibliothèque — LES Graphics Studio",
  description: "Registre des modèles et préréglages Lyon e-Sport 2026.",
};

export default function AdminLibraryPage() {
  return <LibraryStudio />;
}
