import type { Metadata } from "next";
import { GraphicOutputClient } from "../../../components/graphics/graphic-output-client";

export const metadata: Metadata = { title: "Sortie synthé — LES Graphics Studio" };

export default function LowerThirdOutputPage() {
  return <GraphicOutputClient output="synthe" source="program" acknowledge />;
}
