"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  STINGER_ID,
  STINGER_TIMING,
  STINGER_VERSION,
  type StingerPlaybackStatus,
} from "../../lib/stinger/config";
import { StingerRenderer, type StingerRendererHandle } from "./stinger-renderer";
import styles from "./stinger-output-client.module.css";

type StingerBrowserApi = {
  id: typeof STINGER_ID;
  version: typeof STINGER_VERSION;
  durationMs: number;
  ready: boolean;
  status: StingerPlaybackStatus;
  play: (rate?: number) => boolean;
  seek: (timeMs: number) => Promise<{ accepted: boolean; timeMs: number; status: StingerPlaybackStatus }>;
  stop: () => void;
};

declare global {
  interface Window {
    __LES_STINGER__?: StingerBrowserApi;
  }
}

export function StingerOutputClient({ initialTimeMs = null }: { initialTimeMs?: number | null }) {
  const rendererRef = useRef<StingerRendererHandle>(null);
  const initialAppliedRef = useRef(false);
  const [status, setStatus] = useState<StingerPlaybackStatus>("loading");
  const statusRef = useRef<StingerPlaybackStatus>("loading");
  const [scale, setScale] = useState(1);

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
    const api: StingerBrowserApi = {
      id: STINGER_ID,
      version: STINGER_VERSION,
      durationMs: STINGER_TIMING.durationMs,
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
    window.__LES_STINGER__ = api;
    return () => {
      if (window.__LES_STINGER__ === api) delete window.__LES_STINGER__;
    };
  }, []);

  return (
    <main
      className={styles.output}
      data-stinger-status={status}
      style={{
        "--stinger-output-scale": scale,
        opacity: status === "ready" || status === "playing" ? 1 : 0,
      } as CSSProperties}
    >
      <div className={styles.canvas}>
        <StingerRenderer ref={rendererRef} onStatusChange={setStatus} />
      </div>
    </main>
  );
}
