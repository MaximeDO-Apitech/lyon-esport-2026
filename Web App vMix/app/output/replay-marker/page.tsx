import type { Metadata } from "next";
import { ReplayMarkerOutputClient } from "../../../components/graphics/replay-marker-output-client";
import { DEFAULT_REPLAY_MARKER_PLACEMENT, validateReplayMarkerPlacement } from "../../../lib/replay/state";
import type { ReplayMarkerCorner } from "../../../lib/replay/types";

export const metadata: Metadata = { title: "Marqueur replay — LES Graphics Studio" };

export default async function ReplayMarkerOutputPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string; monitor?: string; corner?: string; offsetX?: string; offsetY?: string }>;
}) {
  const params = await searchParams;
  const forceVisible = params.force === "visible";
  let forcedPlacement = null;

  if (forceVisible) {
    try {
      forcedPlacement = validateReplayMarkerPlacement({
        corner: (params.corner ?? DEFAULT_REPLAY_MARKER_PLACEMENT.corner) as ReplayMarkerCorner,
        offsetX: Number(params.offsetX ?? DEFAULT_REPLAY_MARKER_PLACEMENT.offsetX),
        offsetY: Number(params.offsetY ?? DEFAULT_REPLAY_MARKER_PLACEMENT.offsetY),
      });
    } catch {
      forcedPlacement = DEFAULT_REPLAY_MARKER_PLACEMENT;
    }
  }

  return (
    <ReplayMarkerOutputClient
      forcedPlacement={forcedPlacement}
      forceVisible={forceVisible}
      acknowledge={!forceVisible && params.monitor !== "1"}
    />
  );
}
