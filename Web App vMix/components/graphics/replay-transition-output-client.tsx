"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  REPLAY_TRANSITIONS,
  REPLAY_PACK_VERSION,
  type ReplayPlaybackStatus,
  type ReplayTransitionKind,
} from "../../lib/replay/config";
import {
  ReplayTransitionRenderer,
  type ReplayTransitionRendererHandle,
} from "./replay-transition-renderer";
import styles from "./replay-transition-output-client.module.css";

type ReplayTransitionBrowserApi = {
  id: string;
  version: typeof REPLAY_PACK_VERSION;
  kind: ReplayTransitionKind;
  durationMs: number;
  ready: boolean;
  status: ReplayPlaybackStatus;
  play: (rate?: number) => boolean;
  seek: (timeMs: number) => Promise<{ accepted: boolean; timeMs: number; status: ReplayPlaybackStatus }>;
  stop: () => void;
};

declare global {
  interface Window {
    __LES_REPLAY_TRANSITION__?: ReplayTransitionBrowserApi;
  }
}

export function ReplayTransitionOutputClient({
  kind,
  initialTimeMs = null,
}: {
  kind: ReplayTransitionKind;
  initialTimeMs?: number | null;
}) {
  const rendererRef = useRef<ReplayTransitionRendererHandle>(null);
  const initialAppliedRef = useRef(false);
  const [status, setStatus] = useState<ReplayPlaybackStatus>("loading");
  const statusRef = useRef<ReplayPlaybackStatus>("loading");
  const [scale, setScale] = useState(1);
  const timing = REPLAY_TRANSITIONS[kind];

  useEffect(() => {
    const updateScale = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || initialTimeMs === null || initialAppliedRef.current) return;
    initialAppliedRef.current = true;
    rendererRef.current?.seek(initialTimeMs);
  }, [initialTimeMs, status]);

  useEffect(() => {
    const api: ReplayTransitionBrowserApi = {
      id: timing.id,
      version: REPLAY_PACK_VERSION,
      kind,
      durationMs: timing.durationMs,
      get ready() {
        return (rendererRef.current?.getStatus() ?? statusRef.current) === "ready";
      },
      get status() {
        return rendererRef.current?.getStatus() ?? statusRef.current;
      },
      play: (rate = 1) => rendererRef.current?.play(rate) ?? false,
      seek: async (timeMs: number) => {
        const accepted = rendererRef.current?.seek(timeMs) ?? false;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {
          accepted,
          timeMs: rendererRef.current?.getTimeMs() ?? 0,
          status: rendererRef.current?.getStatus() ?? "loading",
        };
      },
      stop: () => rendererRef.current?.stop(),
    };
    window.__LES_REPLAY_TRANSITION__ = api;
    return () => {
      if (window.__LES_REPLAY_TRANSITION__ === api) delete window.__LES_REPLAY_TRANSITION__;
    };
  }, [kind, timing.durationMs, timing.id]);

  return (
    <main
      className={styles.output}
      data-replay-transition-status={status}
      data-replay-transition-kind={kind}
      style={{
        "--replay-output-scale": scale,
        opacity: status === "ready" || status === "playing" ? 1 : 0,
      } as CSSProperties}
    >
      <div className={styles.canvas}>
        <ReplayTransitionRenderer ref={rendererRef} kind={kind} onStatusChange={setStatus} />
      </div>
    </main>
  );
}
