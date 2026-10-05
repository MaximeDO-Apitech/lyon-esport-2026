import assert from "node:assert/strict";
import test from "node:test";
import { classifyRendererOutput, RENDERER_STALE_AFTER_MS } from "../lib/operations/health";
import type { RendererAck } from "../lib/graphics/types";

const NOW = Date.UTC(2026, 9, 5, 20, 0, 0);

function ack(overrides: Partial<RendererAck> = {}): RendererAck {
  return {
    rendererId: "renderer:attente:test",
    output: "attente",
    revision: 4,
    appliedAtUtc: new Date(NOW - 2_000).toISOString(),
    ...overrides,
  };
}

function classify(acks: RendererAck[], expectedRevision = 4) {
  return classifyRendererOutput({
    id: "attente",
    label: "Écran d’attente",
    path: "/output/attente",
    expectedRevision,
    acks,
    nowMs: NOW,
  });
}

test("une sortie sans heartbeat est signalée à vérifier", () => {
  const result = classify([]);
  assert.equal(result.level, "warn");
  assert.equal(result.connectedRenderers, 0);
  assert.equal(result.appliedRevision, null);
});

test("un heartbeat récent avec la bonne révision est opérationnel", () => {
  const result = classify([ack()]);
  assert.equal(result.level, "ok");
  assert.equal(result.connectedRenderers, 1);
  assert.equal(result.appliedRevision, 4);
  assert.equal(result.ageMs, 2_000);
});

test("une source silencieuse au-delà du seuil est signalée absente", () => {
  const result = classify([ack({ appliedAtUtc: new Date(NOW - RENDERER_STALE_AFTER_MS - 1).toISOString() })]);
  assert.equal(result.level, "warn");
  assert.equal(result.connectedRenderers, 0);
});

test("une source active sur une ancienne révision déclenche une erreur", () => {
  const result = classify([ack({ revision: 3 })]);
  assert.equal(result.level, "error");
  assert.match(result.detail, /révision 3/);
  assert.match(result.detail, /4/);
});

test("les heartbeats d’une autre sortie ne faussent pas le statut", () => {
  const result = classify([ack({ output: "synthe" })]);
  assert.equal(result.level, "warn");
  assert.equal(result.connectedRenderers, 0);
});
