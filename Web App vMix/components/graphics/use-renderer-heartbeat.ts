"use client";

import { useEffect, useState } from "react";
import type { RendererOutputId } from "../../lib/graphics/types";

export const RENDERER_HEARTBEAT_INTERVAL_MS = 5_000;

function getRendererId(output: RendererOutputId) {
  const key = `les-renderer-${output}`;
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `renderer:${output}:${crypto.randomUUID()}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

export function useRendererHeartbeat({
  enabled,
  output,
  revision,
}: {
  enabled: boolean;
  output: RendererOutputId;
  revision: number;
}) {
  const [rendererId, setRendererId] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const frame = window.requestAnimationFrame(() => setRendererId(getRendererId(output)));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, output]);

  useEffect(() => {
    if (!enabled || !rendererId) return;
    let active = true;

    const heartbeat = async () => {
      try {
        await fetch("/api/graphics/render-ack", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rendererId, output, revision }),
        });
      } catch {
        // La sortie continue à rendre même si le heartbeat de supervision échoue.
      }
    };

    void heartbeat();
    const interval = window.setInterval(() => {
      if (active) void heartbeat();
    }, RENDERER_HEARTBEAT_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [enabled, output, rendererId, revision]);
}
