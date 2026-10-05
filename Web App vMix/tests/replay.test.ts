import test from "node:test";
import assert from "node:assert/strict";
import { REPLAY_MARKER, REPLAY_TRANSITIONS } from "../lib/replay/config";
import { applyReplayCommand, createInitialReplayState } from "../lib/replay/state";

test("replay assets keep stable independent identifiers and timings", () => {
  assert.equal(REPLAY_TRANSITIONS.in.id, "replay-in-les");
  assert.equal(REPLAY_TRANSITIONS.out.id, "replay-out-les");
  assert.equal(REPLAY_MARKER.id, "replay-marker-les");
  assert.equal(REPLAY_TRANSITIONS.in.durationMs, 800);
  assert.equal(REPLAY_TRANSITIONS.in.cutPointMs, 400);
  assert.deepEqual(REPLAY_TRANSITIONS.in.opaqueWindowMs, [200, 600]);
  assert.equal(REPLAY_TRANSITIONS.out.durationMs, 600);
  assert.equal(REPLAY_TRANSITIONS.out.cutPointMs, 300);
  assert.deepEqual(REPLAY_TRANSITIONS.out.opaqueWindowMs, [160, 400]);
});

test("the 60 fps prototype maps to complete integer frame sequences", () => {
  assert.equal(REPLAY_TRANSITIONS.in.durationMs * 60 / 1000, 48);
  assert.equal(REPLAY_TRANSITIONS.out.durationMs * 60 / 1000, 36);
  assert.equal(REPLAY_TRANSITIONS.in.cutPointMs * 60 / 1000, 24);
  assert.equal(REPLAY_TRANSITIONS.out.cutPointMs * 60 / 1000, 18);
});

test("the marker starts hidden and repeated show does not replay its entrance", () => {
  const initial = createInitialReplayState(1000);
  assert.equal(initial.visibility, "hidden");
  const entering = applyReplayCommand(initial, { id: "test:show:first", type: "marker.show" }, 1100);
  const repeated = applyReplayCommand(entering, { id: "test:show:again", type: "marker.show" }, 1120);
  assert.equal(entering.visibility, "entering");
  assert.equal(repeated.visibility, "entering");
  assert.equal(repeated.transitionStartedAtUtcMs, entering.transitionStartedAtUtcMs);
});

test("opposite marker commands reverse direction and emergency hide is immediate", () => {
  const initial = createInitialReplayState(1000);
  const entering = applyReplayCommand(initial, { id: "test:show:reverse", type: "marker.show" }, 1100);
  const exiting = applyReplayCommand(entering, { id: "test:hide:reverse", type: "marker.hide" }, 1150);
  assert.equal(exiting.visibility, "exiting");
  assert.equal(exiting.transitionStartedAtUtcMs, 1150);
  const hidden = applyReplayCommand(exiting, { id: "test:hide:emergency", type: "marker.hide.immediate" }, 1160);
  assert.equal(hidden.visibility, "hidden");
  assert.equal(hidden.transitionStartedAtUtcMs, null);
});

test("draft, preview and program marker positions remain isolated", () => {
  const initial = createInitialReplayState(1000);
  const draft = applyReplayCommand(initial, {
    id: "test:draft:update",
    type: "marker.draft.update",
    expectedRevision: initial.draft.revision,
    placement: { corner: "top-right", offsetX: 144, offsetY: 88 },
  }, 1100);
  assert.equal(draft.draft.placement.corner, "top-right");
  assert.equal(draft.preview.placement.corner, "top-left");
  assert.equal(draft.program.placement.corner, "top-left");

  const preview = applyReplayCommand(draft, {
    id: "test:preview:prepare",
    type: "marker.preview.prepare",
    expectedDraftRevision: draft.draft.revision,
  }, 1200);
  assert.equal(preview.preview.placement.corner, "top-right");
  assert.equal(preview.program.placement.corner, "top-left");

  const program = applyReplayCommand(preview, {
    id: "test:program:publish",
    type: "marker.program.publish",
    expectedPreviewRevision: preview.previewRevision,
  }, 1300);
  assert.equal(program.program.placement.corner, "top-right");
  assert.deepEqual(program.program.placement, { corner: "top-right", offsetX: 144, offsetY: 88 });
});

test("marker transition timing remains bounded and explicit", () => {
  assert.equal(REPLAY_MARKER.enterMs, 150);
  assert.equal(REPLAY_MARKER.exitMs, 130);
  assert.deepEqual(REPLAY_MARKER.defaultPlacement, { corner: "top-left", offsetX: 96, offsetY: 72 });
});
