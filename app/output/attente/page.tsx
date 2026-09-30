import type { Metadata } from "next";
import { GraphicOutputClient } from "../../../components/graphics/graphic-output-client";

export const metadata: Metadata = { title: "Sortie attente — LES Graphics Studio" };

export default function WaitingOutputPage() {
  return <GraphicOutputClient output="attente" source="program" acknowledge />;
}
