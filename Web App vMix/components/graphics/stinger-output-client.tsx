"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  STINGER_ID,
  STINGER_VERSION,
  getStingerVariant,
  type StingerVariantKey,
  type StingerPlaybackStatus,
} from "../../lib/stinger/config";
import { StingerRenderer, type StingerRendererHandle } from "./stinger-renderer";
import styles from "./stinger-output-client.module.css";

type StingerBrowserApi = {
  id: typeof STINGER_ID;
  version: typeof STINGER_VERSION;
  variant: StingerVariantKey;
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

export function StingerOutputClient({
  variantKey,
  initialTimeMs = null,
  browserTest = false,
}: {
  variantKey: StingerVariantKey;
  initialTimeMs?: number | null;
  browserTest?: boolean;
}) {
  const variant = getStingerVariant(variantKey);
  const rendererRef = useRef<StingerRendererHandle>(null);
  const initialAppliedRef = useRef(false);
  const [status, setStatus] = useState<StingerPlaybackStatus>("loading");
  const statusRef = useRef<StingerPlaybackStatus>("loading");
  const [scale, setScale] = useState(1);
  const [browserReport, setBrowserReport] = useState<{ status: "running" | "pass" | "fail"; value: unknown }>({ status: "running", value: { running: true } });
  const browserTestStartedRef = useRef(false);

  useEffect(() => {
    const updateScale = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    if (!browserTest || status !== "ready" || browserTestStartedRef.current) return;
    browserTestStartedRef.current = true;
    const run = async () => {
      const progress = (stage: string) => setBrowserReport({ status: "running", value: { stage } });
      progress("initialisation");
      const renderer = rendererRef.current;
      const video = document.querySelector("video");
      if (!renderer || !(video instanceof HTMLVideoElement)) throw new Error("Renderer vidéo indisponible.");
      const initial = { status: renderer.getStatus(), timeMs: renderer.getTimeMs() };
      const alphaAt = async (timeMs: number) => {
        if (!await renderer.seek(timeMs)) throw new Error(`Seek refusé à ${timeMs} ms.`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
        const canvas = document.createElement("canvas");
        canvas.width = 1920;
        canvas.height = 1080;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D indisponible.");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let min = 255;
        let max = 0;
        let nonZero = 0;
        for (let offset = 3; offset < pixels.length; offset += 4) {
          const alpha = pixels[offset];
          if (alpha < min) min = alpha;
          if (alpha > max) max = alpha;
          if (alpha > 0) nonZero += 1;
        }
        return { min, max, nonZero, width: canvas.width, height: canvas.height };
      };
      const first = await alphaAt(0);
      progress("alpha-first");
      const cut = await alphaAt(1300);
      progress("alpha-cut");
      const partner = variant.key === "long" ? await alphaAt(3000) : null;
      if (partner) progress("alpha-partner");
      const last = await alphaAt(variant.finalFrameTimeMs);
      progress("alpha-last");
      if (first.max !== 0 || cut.min !== 255 || last.max !== 0 || (partner && partner.min !== 255)) {
        throw new Error(`Alpha navigateur incorrect : ${JSON.stringify({ first, cut, partner, last })}`);
      }
      await renderer.seek(0);
      progress("cycle-playback");
      const firstAccepted = renderer.play(1);
      const secondIgnored = renderer.play(1) === false;
      const playingStatus = renderer.getStatus();
      video.dispatchEvent(new Event("ended"));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      const returnsToReady = renderer.getStatus() === "ready";
      const successiveAccepted = renderer.play(1);
      renderer.stop();
      if (!firstAccepted || !secondIgnored || playingStatus !== "playing" || !returnsToReady || !successiveAccepted) {
        throw new Error("Cycle de déclenchement incorrect.");
      }
      const initialDoesNotReplay = initial.status === "ready" && initial.timeMs < 50;
      if (!initialDoesNotReplay) throw new Error(`État initial inattendu : ${JSON.stringify(initial)}.`);
      return {
        variant: variant.key,
        durationMs: variant.durationMs,
        frameCount: variant.frameCount,
        initialDoesNotReplay,
        alpha: { first, cut, partner, last },
        doubleTrigger: { firstAccepted, secondIgnored },
        returnsToReady,
        successiveAccepted,
      };
    };
    void run().then(
      (value) => setBrowserReport({ status: "pass", value }),
      (error) => setBrowserReport({ status: "fail", value: { error: error instanceof Error ? error.message : String(error) } }),
    );
  }, [browserTest, status, variant]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      const nextStatus = rendererRef.current?.getStatus();
      if (nextStatus && nextStatus !== statusRef.current) setStatus(nextStatus);
    }, 50);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    if (status !== "ready" || initialTimeMs === null || initialAppliedRef.current) return;
    initialAppliedRef.current = true;
    void rendererRef.current?.seek(initialTimeMs);
  }, [initialTimeMs, status]);

  useEffect(() => {
    const api: StingerBrowserApi = {
      id: STINGER_ID,
      version: STINGER_VERSION,
      variant: variant.key,
      durationMs: variant.durationMs,
      get ready() {
        return (rendererRef.current?.getStatus() ?? statusRef.current) === "ready";
      },
      get status() {
        return rendererRef.current?.getStatus() ?? statusRef.current;
      },
      play: (rate = 1) => rendererRef.current?.play(rate) ?? false,
      seek: async (timeMs: number) => {
        const accepted = await (rendererRef.current?.seek(timeMs) ?? Promise.resolve(false));
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
  }, [variant.durationMs, variant.key]);

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
        <StingerRenderer ref={rendererRef} variant={variant} onStatusChange={setStatus} />
      </div>
      {browserTest && (
        <pre id="stinger-browser-result" data-status={browserReport.status} className={styles.browserResult}>
          {JSON.stringify(browserReport.value)}
        </pre>
      )}
    </main>
  );
}
