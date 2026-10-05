import type { RendererAck, RendererOutputId } from "../graphics/types";
import type { OperationsOutputStatus } from "./types";

export const RENDERER_STALE_AFTER_MS = 15_000;

export function classifyRendererOutput({
  id,
  label,
  path,
  expectedRevision,
  acks,
  nowMs,
}: {
  id: RendererOutputId;
  label: string;
  path: string;
  expectedRevision: number;
  acks: RendererAck[];
  nowMs: number;
}): OperationsOutputStatus {
  const candidates = acks
    .filter((ack) => ack.output === id)
    .map((ack) => ({ ack, atMs: Date.parse(ack.appliedAtUtc) }))
    .filter((entry) => Number.isFinite(entry.atMs))
    .sort((a, b) => b.atMs - a.atMs);
  const latest = candidates[0] ?? null;
  const active = candidates.filter((entry) => nowMs - entry.atMs <= RENDERER_STALE_AFTER_MS);
  const ageMs = latest ? Math.max(0, nowMs - latest.atMs) : null;

  if (!latest) {
    return {
      id,
      label,
      path,
      level: "warn",
      detail: "Aucune source de diffusion détectée.",
      expectedRevision,
      appliedRevision: null,
      connectedRenderers: 0,
      lastSeenAtUtc: null,
      ageMs: null,
    };
  }

  if (active.length === 0) {
    return {
      id,
      label,
      path,
      level: "warn",
      detail: "La dernière source détectée ne répond plus.",
      expectedRevision,
      appliedRevision: latest.ack.revision,
      connectedRenderers: 0,
      lastSeenAtUtc: latest.ack.appliedAtUtc,
      ageMs,
    };
  }

  const current = active.find((entry) => entry.ack.revision === expectedRevision);
  if (!current) {
    return {
      id,
      label,
      path,
      level: "error",
      detail: `Source connectée, mais révision ${latest.ack.revision} affichée au lieu de ${expectedRevision}.`,
      expectedRevision,
      appliedRevision: latest.ack.revision,
      connectedRenderers: active.length,
      lastSeenAtUtc: latest.ack.appliedAtUtc,
      ageMs,
    };
  }

  return {
    id,
    label,
    path,
    level: "ok",
    detail: `${active.length} source${active.length > 1 ? "s" : ""} connectée${active.length > 1 ? "s" : ""}, révision à jour.`,
    expectedRevision,
    appliedRevision: current.ack.revision,
    connectedRenderers: active.length,
    lastSeenAtUtc: current.ack.appliedAtUtc,
    ageMs: Math.max(0, nowMs - current.atMs),
  };
}
