import type { Metadata } from "next";
import { GraphicOutputClient } from "../../../components/graphics/graphic-output-client";

export const metadata: Metadata = { title: "Aperçu attente — LES Graphics Studio" };

export default async function WaitingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; freeze?: string; simulation?: string }>;
}) {
  const params = await searchParams;
  const freeze = params.freeze === undefined ? null : Number(params.freeze);
  const simulation = params.simulation === undefined ? null : Number(params.simulation);
  return (
    <GraphicOutputClient
      output="attente"
      source={params.source === "program" ? "program" : "preview"}
      freezeProgress={Number.isFinite(freeze) ? freeze : null}
      simulationSeconds={Number.isFinite(simulation) && Number(simulation) > 0 ? simulation : null}
    />
  );
}
