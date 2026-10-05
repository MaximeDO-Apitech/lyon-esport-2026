"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { REPLAY_MARKER, REPLAY_PACK_VERSION } from "../../lib/replay/config";
import { DEFAULT_REPLAY_MARKER_PLACEMENT } from "../../lib/replay/state";
import type { ReplayMarkerPlacement, ReplayMarkerVisibility } from "../../lib/replay/types";
import { useReplayFeed } from "./use-replay-feed";
import { ReplayMarkerRenderer } from "./replay-marker-renderer";
import styles from "./replay-marker-output-client.module.css";

type ReplayMarkerBrowserApi = {
  id: typeof REPLAY_MARKER.id;
  version: typeof REPLAY_PACK_VERSION;
  ready: boolean;
  visibility: ReplayMarkerVisibility;
  placement: ReplayMarkerPlacement;
};

declare global {
  interface Window {
    __LES_REPLAY_MARKER__?: ReplayMarkerBrowserApi;
  }
}

export function ReplayMarkerOutputClient({
  forcedPlacement = null,
  forceVisible = false,
}: {
  forcedPlacement?: ReplayMarkerPlacement | null;
  forceVisible?: boolean;
}) {
  const { envelope, connection } = useReplayFeed(120);
  const [scale, setScale] = useState(1);
  const placement = forcedPlacement ?? envelope?.state.program.placement ?? DEFAULT_REPLAY_MARKER_PLACEMENT;
  const visibility: ReplayMarkerVisibility = forceVisible ? "visible" : envelope?.state.visibility ?? "hidden";
  const ready = forceVisible || connection === "connected";

  useEffect(() => {
    const updateScale = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const api = useMemo<ReplayMarkerBrowserApi>(() => ({
    id: REPLAY_MARKER.id,
    version: REPLAY_PACK_VERSION,
    ready,
    visibility,
    placement,
  }), [placement, ready, visibility]);

  useEffect(() => {
    window.__LES_REPLAY_MARKER__ = api;
    return () => {
      if (window.__LES_REPLAY_MARKER__ === api) delete window.__LES_REPLAY_MARKER__;
    };
  }, [api]);

  return (
    <main
      className={styles.output}
      data-replay-marker-ready={ready ? "true" : "false"}
      style={{
        "--replay-marker-scale": scale,
        opacity: ready ? 1 : 0,
      } as CSSProperties}
    >
      <div className={styles.canvas}>
        <ReplayMarkerRenderer
          placement={placement}
          visibility={visibility}
          staticVisible={forceVisible}
        />
      </div>
    </main>
  );
}
