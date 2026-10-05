import type { Metadata } from "next";
import { ReplayTransitionOutputClient } from "../../../components/graphics/replay-transition-output-client";

export const metadata: Metadata = { title: "Sortie replay — LES Graphics Studio" };

export default async function ReplayOutOutputPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string }>;
}) {
  const params = await searchParams;
  const requestedTime = params.time === undefined ? null : Number(params.time);
  return <ReplayTransitionOutputClient kind="out" initialTimeMs={Number.isFinite(requestedTime) ? requestedTime : null} />;
}
