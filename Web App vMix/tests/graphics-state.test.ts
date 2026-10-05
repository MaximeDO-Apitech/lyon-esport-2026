import assert from "node:assert/strict";
import test from "node:test";
import { applyGraphicsCommand, createInitialState, getTimerRemainingMs, normalizeGraphicsState } from "../lib/graphics/state";
import { parisWallTimeToUtcMs, utcMsToParisLocalInput } from "../lib/graphics/time";
import { validateLowerThirdContent, validatePresetExport, validateWaitingContent } from "../lib/graphics/validation";

const T0 = Date.UTC(2026, 10, 13, 17, 0, 0);

test("un brouillon n’altère jamais le programme", () => {
  const initial = createInitialState(T0);
  const next = applyGraphicsCommand(initial, {
    id: "draft:test-0001",
    type: "draft.update",
    output: "attente",
    expectedRevision: 1,
    content: { message: "ON REVIENT DANS UN INSTANT", countdownEnabled: false },
  }, T0 + 100);
  assert.equal(next.attente.draft.content.message, "ON REVIENT DANS UN INSTANT");
  assert.equal(next.attente.program?.content.message, "LE LIVE COMMENCE BIENTÔT");
  assert.equal(next.attente.programRevision, 1);
});

test("publier applique exactement la révision prévisualisée", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, {
    id: "draft:test-0002",
    type: "draft.update",
    output: "attente",
    expectedRevision: 1,
    content: { message: "ON REVIENT DANS UN INSTANT", countdownEnabled: true },
  }, T0 + 100);
  state = applyGraphicsCommand(state, {
    id: "preview:test-0002",
    type: "preview.prepare",
    output: "attente",
    expectedDraftRevision: 2,
  }, T0 + 200);
  state = applyGraphicsCommand(state, {
    id: "draft:test-0003",
    type: "draft.update",
    output: "attente",
    expectedRevision: 2,
    content: { message: "MODIFICATION NON PRÉVISUALISÉE", countdownEnabled: true },
  }, T0 + 300);
  state = applyGraphicsCommand(state, {
    id: "publish:test-0002",
    type: "program.publish",
    output: "attente",
    expectedPreviewRevision: 2,
  }, T0 + 400);
  assert.equal(state.attente.program?.content.message, "ON REVIENT DANS UN INSTANT");
  assert.equal(state.attente.draft.content.message, "MODIFICATION NON PRÉVISUALISÉE");
});

test("les sorties et le compteur restent indépendants", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, {
    id: "timer:test-0001",
    type: "timer.start",
  }, T0);
  const timerEnd = state.timer.endAtUtcMs;
  state = applyGraphicsCommand(state, {
    id: "draft:test-0004",
    type: "draft.update",
    output: "synthe",
    expectedRevision: 1,
    content: { name: "Nova", role: "Host", organization: "Lyon e-Sport" },
  }, T0 + 100);
  state = applyGraphicsCommand(state, {
    id: "preview:test-0004",
    type: "preview.prepare",
    output: "synthe",
    expectedDraftRevision: 2,
  }, T0 + 200);
  state = applyGraphicsCommand(state, {
    id: "publish:test-0004",
    type: "program.publish",
    output: "synthe",
    expectedPreviewRevision: 1,
  }, T0 + 300);
  assert.equal(state.timer.status, "running");
  assert.equal(state.timer.endAtUtcMs, timerEnd);
  assert.equal(state.attente.programRevision, 1);
  assert.equal(state.synthe.visibility, "hidden");
});

test("pause et reprise conservent le temps restant", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, { id: "timer:test-0002", type: "timer.start" }, T0);
  state = applyGraphicsCommand(state, { id: "timer:test-0003", type: "timer.pause" }, T0 + 12_000);
  assert.equal(state.timer.remainingMsAtPause, 888_000);
  assert.equal(getTimerRemainingMs(state, T0 + 60_000), 888_000);
  state = applyGraphicsCommand(state, { id: "timer:test-0004", type: "timer.resume" }, T0 + 60_000);
  assert.equal(state.timer.endAtUtcMs, T0 + 948_000);
  assert.equal(getTimerRemainingMs(normalizeGraphicsState(state, T0 + 70_000), T0 + 70_000), 878_000);
});

test("le compteur s’arrête à zéro sans valeur négative", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, {
    id: "timer:test-0005",
    type: "timer.configure",
    configuration: { mode: "duration", durationSeconds: 2, targetUtcMs: null, timeZone: "Europe/Paris" },
  }, T0);
  state = applyGraphicsCommand(state, { id: "timer:test-0006", type: "timer.start" }, T0);
  const finished = normalizeGraphicsState(state, T0 + 5_000);
  assert.equal(finished.timer.status, "completed");
  assert.equal(getTimerRemainingMs(finished, T0 + 5_000), 0);
});

test("le remplacement d’un synthé visible sort puis rentre avec le nouveau contenu", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, {
    id: "draft:test-0005",
    type: "draft.update",
    output: "synthe",
    expectedRevision: 1,
    content: { name: "Camille", role: "Caster", organization: "" },
  }, T0);
  state = applyGraphicsCommand(state, { id: "preview:test-0005", type: "preview.prepare", output: "synthe", expectedDraftRevision: 2 }, T0 + 10);
  state = applyGraphicsCommand(state, { id: "publish:test-0005", type: "program.publish", output: "synthe", expectedPreviewRevision: 1 }, T0 + 20);
  state = applyGraphicsCommand(state, { id: "show:test-0001", type: "synthe.show" }, T0 + 30);
  state = normalizeGraphicsState(state, T0 + 500);
  assert.equal(state.synthe.visibility, "visible");

  state = applyGraphicsCommand(state, {
    id: "draft:test-0006",
    type: "draft.update",
    output: "synthe",
    expectedRevision: 2,
    content: { name: "Maëlys", role: "Host", organization: "LES" },
  }, T0 + 600);
  state = applyGraphicsCommand(state, { id: "preview:test-0006", type: "preview.prepare", output: "synthe", expectedDraftRevision: 3 }, T0 + 610);
  state = applyGraphicsCommand(state, { id: "publish:test-0006", type: "program.publish", output: "synthe", expectedPreviewRevision: 2 }, T0 + 620);
  assert.equal(state.synthe.visibility, "exiting");
  assert.equal(state.synthe.program?.content.name, "Camille");
  state = normalizeGraphicsState(state, T0 + 950);
  assert.equal(state.synthe.visibility, "entering");
  assert.equal(state.synthe.program?.content.name, "Maëlys");
  state = normalizeGraphicsState(state, T0 + 1_400);
  assert.equal(state.synthe.visibility, "visible");
});

test("les accents et champs secondaires vides sont conservés proprement", () => {
  assert.deepEqual(validateLowerThirdContent({ name: "Maëlys", role: "", organization: "" }), {
    name: "Maëlys",
    role: "",
    organization: "",
  });
  assert.equal(validateWaitingContent({ message: "Le live commence bientôt", countdownEnabled: true }).message, "LE LIVE COMMENCE BIENTÔT");
  assert.throws(() => validateLowerThirdContent({ name: "X".repeat(37), role: "", organization: "" }), /36 caractères/);
});

test("un brouillon incomplet reste synchronisable mais ne peut pas être prévisualisé", () => {
  let state = createInitialState(T0);
  state = applyGraphicsCommand(state, {
    id: "draft:blank-synthe",
    type: "draft.update",
    output: "synthe",
    expectedRevision: 1,
    content: { name: "", role: "", organization: "" },
  }, T0 + 1);
  assert.equal(state.synthe.draft.content.name, "");
  assert.throws(() => applyGraphicsCommand(state, {
    id: "preview:blank-synthe",
    type: "preview.prepare",
    output: "synthe",
    expectedDraftRevision: 2,
  }, T0 + 2), /obligatoire/);
});

test("les imports JSON invalides sont rejetés", () => {
  assert.throws(() => validatePresetExport({ schemaVersion: 9 }), /Version de préréglage/);
  assert.throws(() => validatePresetExport({ schemaVersion: 1, templateId: "inconnu", templateVersion: "1", name: "Test", content: {} }), /modèle/i);
});

test("les heures événementielles sont converties explicitement en Europe/Paris", () => {
  const winter = parisWallTimeToUtcMs("2026-11-13T19:00");
  assert.equal(new Date(winter).toISOString(), "2026-11-13T18:00:00.000Z");
  assert.equal(utcMsToParisLocalInput(winter), "2026-11-13T19:00");
  const summer = parisWallTimeToUtcMs("2026-07-01T19:00");
  assert.equal(new Date(summer).toISOString(), "2026-07-01T17:00:00.000Z");
});
