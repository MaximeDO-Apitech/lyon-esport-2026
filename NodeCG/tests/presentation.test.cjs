const assert = require("node:assert/strict");
const test = require("node:test");
const { applyPresentationCommand, defaultPresentation } = require("../extension/presentation.js");

test("l'arret d'urgence masque immediatement le programme", () => {
  let state = defaultPresentation(1);
  state = applyPresentationCommand(state, { id: "command:show:0001", action: "program.show" }, 2);
  assert.equal(state.program.visible, true);
  assert.equal(state.program.emergencyClear, false);
  state = applyPresentationCommand(state, { id: "command:clear:0002", action: "program.emergency-clear" }, 3);
  assert.equal(state.program.visible, false);
  assert.equal(state.program.emergencyClear, true);
});

test("publier l'apercu ne met pas le HUD a l'antenne", () => {
  let state = defaultPresentation(1);
  state = applyPresentationCommand(state, { id: "command:delay:before", action: "program.delay", value: 1200 }, 2);
  state = applyPresentationCommand(state, { id: "command:autohide:01", action: "program.auto-hide", value: true }, 2);
  state = applyPresentationCommand(state, { id: "command:preview:001", action: "preview.mode", value: "full" }, 2);
  state = applyPresentationCommand(state, { id: "command:publish:002", action: "preview.publish" }, 3);
  assert.equal(state.program.mode, "full");
  assert.equal(state.program.visible, false);
  assert.equal(state.program.emergencyClear, false);
  assert.equal(state.program.modules.players, true);
  assert.equal(state.program.delayMs, 1200);
  assert.equal(state.program.autoHideOnDisconnect, true);
});

test("le delai est borne a quinze secondes", () => {
  const state = applyPresentationCommand(defaultPresentation(1), { id: "command:delay:0001", action: "program.delay", value: 90_000 }, 2);
  assert.equal(state.program.delayMs, 15_000);
});

test("une commande immediate dupliquee n'est pas rejouee", () => {
  const first = applyPresentationCommand(defaultPresentation(1), { id: "command:repeat:01", action: "program.show" }, 2);
  const duplicate = applyPresentationCommand(first, { id: "command:repeat:01", action: "program.hide" }, 3);
  assert.equal(duplicate, first);
  assert.equal(duplicate.program.visible, true);
});
