const presentationRep = nodecg.Replicant("presentation");
let current = null;

presentationRep.on("change", (value) => {
  current = value;
  if (!value) return;
  const program = value.program;
  lesUi.text("mode", program.mode);
  lesUi.text("revision", String(value.revision));
  const badge = document.getElementById("program-state");
  badge.textContent = program.emergencyClear ? "urgence" : program.replaySuppressed ? "replay" : program.visible ? "visible" : "masque";
  badge.className = program.visible && !program.replaySuppressed ? "badge ok" : program.emergencyClear ? "badge error" : "badge warn";
  const form = document.getElementById("modules-form");
  for (const [name, checked] of Object.entries(program.modules)) form.elements[name].checked = checked;
  form.elements.autoHideOnDisconnect.checked = program.autoHideOnDisconnect;
  form.elements.delay.value = program.delayMs;
  const replay = document.getElementById("replay");
  replay.dataset.value = String(!program.replaySuppressed);
  replay.textContent = program.replaySuppressed ? "Quitter le replay" : "Entrer en replay";
});

document.querySelectorAll("button[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const rawValue = button.dataset.value;
    let value;
    if (rawValue === "true" || rawValue === "false") value = rawValue === "true";
    else if (rawValue !== undefined) value = rawValue;
    lesUi.send("les:presentation:command", {
      id: lesUi.commandId("dashboard"),
      action: button.dataset.action,
      ...(value === undefined ? {} : { value }),
    });
  });
});

document.getElementById("modules-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const modules = Object.fromEntries(["score", "players", "observed", "series", "spike"].map((name) => [name, form.elements[name].checked]));
  await lesUi.send("les:presentation:command", {
    id: lesUi.commandId("modules"),
    action: "program.modules",
    value: modules,
  });
  await lesUi.send("les:presentation:command", {
    id: lesUi.commandId("autohide"),
    action: "program.auto-hide",
    value: form.elements.autoHideOnDisconnect.checked,
  });
  await lesUi.send("les:presentation:command", {
    id: lesUi.commandId("delay"),
    action: "program.delay",
    value: Number(form.elements.delay.value),
  });
});
