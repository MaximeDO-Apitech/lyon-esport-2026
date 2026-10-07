"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  GraphicSnapshot,
  GraphicsState,
  LowerThirdContent,
  ProgramTimer,
  WaitingContent,
} from "../../lib/graphics/types";
import { LowerThirdRenderer } from "./lower-third-renderer";
import { useGraphicsFeed } from "./use-graphics-feed";
import { useRendererHeartbeat } from "./use-renderer-heartbeat";
import { WaitingRenderer } from "./waiting-renderer";

type GraphicOutputClientProps = {
  output: "attente" | "synthe";
  source: "preview" | "program";
  acknowledge?: boolean;
  previewBackground?: "transparent" | "checker" | "light" | "dark";
  freezeProgress?: number | null;
  simulationSeconds?: number | null;
  showLayoutGuides?: boolean;
};

export function GraphicOutputClient({
  output,
  source,
  acknowledge = false,
  previewBackground = "transparent",
  freezeProgress = null,
  simulationSeconds = null,
  showLayoutGuides = false,
}: GraphicOutputClientProps) {
  const { envelope, getServerNowMs } = useGraphicsFeed(100);
  const [simulationEndAtServerMs, setSimulationEndAtServerMs] = useState(0);
  const simulationKeyRef = useRef("");
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
    if (!envelope || source !== "preview" || output !== "attente" || !simulationSeconds) return;
    const key = `${output}:${simulationSeconds}`;
    if (simulationKeyRef.current === key) return;
    simulationKeyRef.current = key;
    setSimulationEndAtServerMs(getServerNowMs() + simulationSeconds * 1000);
  }, [envelope, getServerNowMs, output, simulationSeconds, source]);

  const snapshot = envelope
    ? source === "preview"
      ? envelope.state[output].preview
      : envelope.state[output].program
    : null;
  const revision = snapshot?.revision ?? 0;
  useRendererHeartbeat({ enabled: acknowledge && Boolean(envelope), output, revision });

  const previewState = useMemo(() => {
    if (!envelope || source !== "preview" || output !== "attente" || !simulationSeconds || !simulationEndAtServerMs) {
      return envelope?.state ?? null;
    }
    const timer: ProgramTimer = {
      ...envelope.state.timer,
      status: "running",
      endAtUtcMs: simulationEndAtServerMs,
      remainingMsAtPause: simulationSeconds * 1000,
      showDigits: true,
    };
    return { ...envelope.state, timer } as GraphicsState;
  }, [envelope, output, simulationEndAtServerMs, simulationSeconds, source]);

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
          showLayoutGuides={source === "preview" && showLayoutGuides}
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
