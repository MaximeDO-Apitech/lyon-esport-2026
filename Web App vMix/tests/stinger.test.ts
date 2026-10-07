import test from "node:test";
import assert from "node:assert/strict";
import {
  STINGER_CUT_FRAME,
  STINGER_CUT_POINT_MS,
  STINGER_FPS,
  STINGER_ID,
  STINGER_VARIANTS,
  STINGER_VARIANT_LIST,
  getStingerVariant,
} from "../lib/stinger/config";

test("the stinger keeps a stable isolated identifier", () => {
  assert.equal(STINGER_ID, "stinger-principal-les");
});

test("the two supplied-media variants are exposed in the same family", () => {
  assert.deepEqual(STINGER_VARIANT_LIST.map((variant) => variant.key), ["short", "long"]);
  assert.equal(STINGER_VARIANTS.short.durationMs, 2000);
  assert.equal(STINGER_VARIANTS.short.frameCount, 120);
  assert.equal(STINGER_VARIANTS.long.durationMs, 5000);
  assert.equal(STINGER_VARIANTS.long.frameCount, 300);
  assert.equal(getStingerVariant("invalid"), STINGER_VARIANTS.short);
});

test("the 1.3 second cut maps to frame 78 and stays inside both opaque windows", () => {
  assert.equal(STINGER_FPS, 60);
  assert.equal(STINGER_CUT_FRAME, 78);
  assert.equal(STINGER_CUT_POINT_MS * STINGER_FPS / 1000, STINGER_CUT_FRAME);
  for (const variant of STINGER_VARIANT_LIST) {
    assert.ok(STINGER_CUT_FRAME >= variant.opaqueWindowFrames[0]);
    assert.ok(STINGER_CUT_FRAME <= variant.opaqueWindowFrames[1]);
    assert.ok(STINGER_CUT_POINT_MS > variant.opaqueWindowMs[0]);
    assert.ok(STINGER_CUT_POINT_MS < variant.opaqueWindowMs[1]);
  }
});

test("each variant ends on a real transparent-frame sample", () => {
  assert.equal(STINGER_VARIANTS.short.finalFrameTimeMs, 119.5 * 1000 / 60);
  assert.equal(STINGER_VARIANTS.long.finalFrameTimeMs, 299.5 * 1000 / 60);
  for (const variant of STINGER_VARIANT_LIST) {
    assert.ok(variant.finalFrameTimeMs < variant.durationMs);
    assert.equal(variant.audio, false);
    assert.equal(variant.alpha, "source-preserved");
    assert.equal(variant.validationStatus, "needs_visual_validation");
  }
});

test("the long master keeps its partner cartouche interval", () => {
  assert.deepEqual(STINGER_VARIANTS.long.cartoucheWindowMs, [2150, 4300]);
  assert.equal(STINGER_VARIANTS.short.cartoucheWindowMs, null);
});
