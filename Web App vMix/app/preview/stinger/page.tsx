import type { Metadata } from "next";
import { StingerPreviewClient } from "../../../components/graphics/stinger-preview-client";

export const metadata: Metadata = { title: "Aperçu stinger — LES Graphics Studio" };

export default async function StingerPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string }>;
}) {
  const params = await searchParams;
  return <StingerPreviewClient browserTest={params.test === "1"} />;
}
