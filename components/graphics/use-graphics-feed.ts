"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphicsCommand, GraphicsStateEnvelope } from "../../lib/graphics/types";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export function createCommandId(prefix = "cmd") {
  return `${prefix}:${crypto.randomUUID()}`;
}

export function getAdminToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("les-admin-token") ?? "";
}

export async function postGraphicsCommand(command: GraphicsCommand) {
  const token = getAdminToken();
  const response = await fetch("/api/graphics/command", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Commande refusée.");
  return payload;
}

export function useGraphicsFeed(pollMs = 250) {
  const [envelope, setEnvelope] = useState<GraphicsStateEnvelope | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const sync = useRef({ serverTimeUtcMs: 0, monotonicMs: 0 });

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/graphics/state", { cache: "no-store", signal });
      if (!response.ok) throw new Error(`État indisponible (${response.status}).`);
      const payload = (await response.json()) as GraphicsStateEnvelope;
      sync.current = {
        serverTimeUtcMs: payload.serverTimeUtcMs,
        monotonicMs: performance.now(),
      };
      setEnvelope(payload);
      setConnection("connected");
      setError(null);
      return payload;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return null;
      setConnection("disconnected");
      setError(caught instanceof Error ? caught.message : "Connexion au serveur perdue.");
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timeout = 0;
    let active = true;

    const poll = async () => {
      await refresh(controller.signal);
      if (active) timeout = window.setTimeout(poll, pollMs);
    };
    void poll();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [pollMs, refresh]);

  const getServerNowMs = useCallback(() => {
    const base = sync.current;
    if (!base.monotonicMs) return Date.now();
    return base.serverTimeUtcMs + (performance.now() - base.monotonicMs);
  }, []);

  return { envelope, connection, error, refresh, getServerNowMs };
}
