import type { Metadata } from "next";
import { StingerOutputClient } from "../../../components/graphics/stinger-output-client";

export const metadata: Metadata = { title: "Sortie stinger — LES Graphics Studio" };

export default async function StingerOutputPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string }>;
}) {
  const params = await searchParams;
  const requestedTime = params.time === undefined ? null : Number(params.time);
  return <StingerOutputClient initialTimeMs={Number.isFinite(requestedTime) ? requestedTime : null} />;
}
