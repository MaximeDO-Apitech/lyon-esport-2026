import type { Metadata } from "next";
import { StatusStudio } from "../../../components/admin/status-studio";

export const metadata: Metadata = { title: "Statut régie — LES Graphics Studio" };

export default function StatusPage() {
  return <StatusStudio />;
}
