import type { Metadata } from "next";
import { StingerOutputClient } from "../../../components/graphics/stinger-output-client";
import { isStingerVariantKey } from "../../../lib/stinger/config";

export const metadata: Metadata = { title: "Sortie stinger — LES Graphics Studio" };

export default async function StingerOutputPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string; variant?: string; test?: string }>;
}) {
  const params = await searchParams;
  const requestedTime = params.time === undefined ? null : Number(params.time);
  const variantKey = isStingerVariantKey(params.variant) ? params.variant : "short";
  return (
    <StingerOutputClient
      variantKey={variantKey}
      initialTimeMs={Number.isFinite(requestedTime) ? requestedTime : null}
      browserTest={params.test === "1"}
    />
  );
}
