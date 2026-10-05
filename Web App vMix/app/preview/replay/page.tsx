import type { Metadata } from "next";
import { ReplayPreviewClient } from "../../../components/graphics/replay-preview-client";

export const metadata: Metadata = {
  title: "Banc de test replay — LES Graphics Studio",
  description: "Validation locale de la chaîne replay sans commande programme.",
};

export default function ReplayPreviewPage() {
  return <ReplayPreviewClient />;
}
