"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  GraphicSnapshot,
  GraphicsState,
  LowerThirdContent,
  ProgramTimer,
  WaitingContent,
} from "../../lib/graphics/types";
import { LowerThirdRenderer } from "./lower-third-renderer";
import { useGraphicsFeed } from "./use-graphics-feed";
import { WaitingRenderer } from "./waiting-renderer";

type GraphicOutputClientProps = {
  output: "attente" | "synthe";
  source: "preview" | "program";
  acknowledge?: boolean;
  previewBackground?: "transparent" | "checker" | "light" | "dark";
  freezeProgress?: number | null;
  simulationSeconds?: number | null;
};

function rendererId(output: string) {
  const key = `les-renderer-${output}`;
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `renderer:${output}:${crypto.randomUUID()}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

export function GraphicOutputClient({
  output,
  source,
  acknowledge = false,
  previewBackground = "transparent",
  freezeProgress = null,
  simulationSeconds = null,
}: GraphicOutputClientProps) {
  const { envelope, getServerNowMs } = useGraphicsFeed(100);
  const [renderId, setRenderId] = useState("");
  const [simulationStartedAt, setSimulationStartedAt] = useState(0);
  const [viewportScale, setViewportScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      setViewportScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRenderId(rendererId(output));
      setSimulationStartedAt(Date.now());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [output, simulationSeconds]);

  const snapshot = envelope
    ? source === "preview"
      ? envelope.state[output].preview
      : envelope.state[output].program
    : null;
  const revision = snapshot?.revision ?? 0;

  useEffect(() => {
    if (!acknowledge || !renderId || !envelope) return;
    void fetch("/api/graphics/render-ack", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rendererId: renderId, output, revision }),
    });
  }, [acknowledge, envelope, output, renderId, revision]);

  const previewState = useMemo(() => {
    if (!envelope || source !== "preview" || output !== "attente" || !simulationSeconds || !simulationStartedAt) {
      return envelope?.state ?? null;
    }
    const timer: ProgramTimer = {
      ...envelope.state.timer,
      status: "running",
      endAtUtcMs: simulationStartedAt + simulationSeconds * 1000,
      remainingMsAtPause: simulationSeconds * 1000,
      showDigits: true,
    };
    return { ...envelope.state, timer } as GraphicsState;
  }, [envelope, output, simulationSeconds, simulationStartedAt, source]);

  return (
    <main
      className={`graphic-output graphic-output-${output} preview-background-${previewBackground}`}
      style={{ "--gfx-scale": viewportScale } as CSSProperties}
    >
      {output === "attente" ? (
        <WaitingRenderer
          snapshot={snapshot as GraphicSnapshot<WaitingContent> | null}
          state={previewState}
          getServerNowMs={getServerNowMs}
          freezeProgress={source === "preview" ? freezeProgress : null}
        />
      ) : (
        <LowerThirdRenderer
          snapshot={snapshot as GraphicSnapshot<LowerThirdContent> | null}
          visibility={source === "preview" ? "visible" : envelope?.state.synthe.visibility ?? "hidden"}
          transitionStartedAtUtcMs={source === "preview" ? null : envelope?.state.synthe.transitionStartedAtUtcMs ?? null}
          getServerNowMs={getServerNowMs}
          forceVisible={source === "preview"}
        />
      )}
    </main>
  );
}
