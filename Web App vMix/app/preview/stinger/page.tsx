import type { Metadata } from "next";
import { StingerPreviewClient } from "../../../components/graphics/stinger-preview-client";

export const metadata: Metadata = { title: "Aperçu stinger — LES Graphics Studio" };

export default function StingerPreviewPage() {
  return <StingerPreviewClient />;
}
