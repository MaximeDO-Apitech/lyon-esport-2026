import test from "node:test";
import assert from "node:assert/strict";
import { STINGER_ID, STINGER_TIMING } from "../lib/stinger/config";

test("the stinger keeps a stable isolated identifier", () => {
  assert.equal(STINGER_ID, "stinger-principal-les");
});

test("the cut remains inside the fully covered interval", () => {
  assert.ok(STINGER_TIMING.cutPointMs > STINGER_TIMING.entryEndMs);
  assert.ok(STINGER_TIMING.cutPointMs < STINGER_TIMING.exitStartMs);
});

test("the 60 fps prototype maps to 72 sequential samples", () => {
  const frameCount = STINGER_TIMING.durationMs * STINGER_TIMING.prototypeFps / 1000;
  assert.equal(frameCount, 72);
  assert.equal(STINGER_TIMING.cutPointMs * STINGER_TIMING.prototypeFps / 1000, 36);
});

test("the final transparent tail is positive", () => {
  assert.ok(STINGER_TIMING.durationMs > STINGER_TIMING.transparentEndMs);
});
