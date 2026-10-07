import test from "node:test";
import assert from "node:assert/strict";
import { WAITING_LAYOUT, WAITING_LAYOUT_DERIVED, WAITING_LAYOUT_REVISION } from "../lib/waiting/layout";

test("the waiting frame uses one regular inner rectangle", () => {
  assert.equal(WAITING_LAYOUT_REVISION, "les-da-2026-r9");
  assert.deepEqual(WAITING_LAYOUT.frame, {
    left: 96,
    right: 1824,
    top: 72,
    bottom: 1008,
  });
  assert.equal(WAITING_LAYOUT.frame.left, WAITING_LAYOUT.width - WAITING_LAYOUT.frame.right);
  assert.equal(WAITING_LAYOUT.frame.top, WAITING_LAYOUT.height - WAITING_LAYOUT.frame.bottom);
});

test("corner authority zones stay clear of the secondary matrices", () => {
  const topRightAuthorityLeft = WAITING_LAYOUT.frame.right - WAITING_LAYOUT.corner.authoritySize;
  const topRightMatrixRight = WAITING_LAYOUT_DERIVED.matrixTopRightLeft + WAITING_LAYOUT.matrix.renderedWidth;
  const bottomLeftAuthorityRight = WAITING_LAYOUT.frame.left + WAITING_LAYOUT.corner.authoritySize;

  assert.ok(topRightAuthorityLeft - topRightMatrixRight >= 24);
  assert.ok(WAITING_LAYOUT.matrix.bottomLeft.left - bottomLeftAuthorityRight >= 24);
  assert.equal(WAITING_LAYOUT.matrix.renderedWidth, 112);
  assert.equal(WAITING_LAYOUT.matrix.driftX, 2.5);
  assert.ok(WAITING_LAYOUT.matrix.topRightOpacity < WAITING_LAYOUT.corner.coreOpacityMin);
  assert.ok(WAITING_LAYOUT.matrix.bottomLeftOpacity < WAITING_LAYOUT.corner.coreOpacityMin);
});

test("corner light support favors a sharp core over a broad halo", () => {
  assert.ok(WAITING_LAYOUT.corner.coreOpacityMin >= 0.85);
  assert.ok(WAITING_LAYOUT.corner.coreOpacityMax <= 1);
  assert.ok(WAITING_LAYOUT.corner.haloOpacityMax <= 0.08);
  assert.ok(WAITING_LAYOUT.corner.haloBlur <= 4);
});

test("the two canonical dotted rails deliberately use different vertical anchors", () => {
  assert.equal(WAITING_LAYOUT.rail.rightCenterY, 324);
  assert.equal(WAITING_LAYOUT.rail.leftCenterY, 702);
  assert.equal(WAITING_LAYOUT_DERIVED.rightRailTop, 224);
  assert.equal(WAITING_LAYOUT_DERIVED.leftRailTop, 602);
  assert.equal(WAITING_LAYOUT_DERIVED.railCenterDeltaY, 378);
  assert.notEqual(WAITING_LAYOUT.rail.leftCenterY, WAITING_LAYOUT.rail.rightCenterY);
});

test("the rail construction and canvas remain explicit", () => {
  assert.equal(WAITING_LAYOUT.width, 1920);
  assert.equal(WAITING_LAYOUT.height, 1080);
  assert.equal(WAITING_LAYOUT.rail.height, 200);
  assert.equal(WAITING_LAYOUT.rail.dotDiameter, 3.5);
  assert.equal(WAITING_LAYOUT.rail.centerSpacing, 10);
  assert.equal(WAITING_LAYOUT.rail.terminalDiameter, 8);
  assert.equal(WAITING_LAYOUT.rail.crossSpan, 14);
  assert.equal(WAITING_LAYOUT.rail.crossStroke, 2.5);
});
