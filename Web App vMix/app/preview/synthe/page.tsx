import type { Metadata } from "next";
import { GraphicOutputClient } from "../../../components/graphics/graphic-output-client";

export const metadata: Metadata = { title: "Aperçu synthé — LES Graphics Studio" };

export default async function LowerThirdPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; background?: string }>;
}) {
  const params = await searchParams;
  const background = ["transparent", "checker", "light", "dark"].includes(params.background ?? "")
    ? (params.background as "transparent" | "checker" | "light" | "dark")
    : "checker";
  return (
    <GraphicOutputClient
      output="synthe"
      source={params.source === "program" ? "program" : "preview"}
      previewBackground={background}
    />
  );
}
