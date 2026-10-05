"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplayCommand, ReplayCommandResult, ReplayStateEnvelope } from "../../lib/replay/types";

export type ReplayConnectionState = "connecting" | "connected" | "disconnected";

export function createReplayCommandId(prefix = "replay") {
  return `${prefix}:${crypto.randomUUID()}`;
}

function getAdminToken() {
  return window.sessionStorage.getItem("les-admin-token")?.trim() ?? "";
}

export async function postReplayCommand(command: ReplayCommand): Promise<ReplayCommandResult> {
  const token = getAdminToken();
  const response = await fetch("/api/replay/command", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json() as ReplayCommandResult & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Commande replay refusée.");
  return payload;
}

export function useReplayFeed(intervalMs = 500) {
  const [envelope, setEnvelope] = useState<ReplayStateEnvelope | null>(null);
  const [connection, setConnection] = useState<ReplayConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/replay/state", { cache: "no-store" });
      if (!response.ok) throw new Error("État replay indisponible.");
      const next = await response.json() as ReplayStateEnvelope;
      if (!active.current) return null;
      setEnvelope(next);
      setConnection("connected");
      setError(null);
      return next;
    } catch (caught) {
      if (!active.current) return null;
      setConnection("disconnected");
      setError(caught instanceof Error ? caught.message : "Connexion replay interrompue.");
      return null;
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const frame = window.requestAnimationFrame(() => void refresh());
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      active.current = false;
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [intervalMs, refresh]);

  return { envelope, connection, error, refresh };
}
