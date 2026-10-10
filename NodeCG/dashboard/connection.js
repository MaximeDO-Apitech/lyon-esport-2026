const connectionRep = nodecg.Replicant("connection-status");

connectionRep.on("change", (status) => {
  if (!status) return;
  lesUi.text("profile", status.profile);
  lesUi.text("protocol", `${status.protocol} · ${status.namespace} · ${status.path}`);
  lesUi.text("group", status.groupHint);
  lesUi.text("packet", lesUi.date(status.lastPacketAt));
  lesUi.text("change", lesUi.date(status.lastChangeAt));
  lesUi.text("error", status.lastError || "Aucune erreur remontee.");
  const transport = document.getElementById("transport");
  transport.textContent = status.phase;
  transport.className = lesUi.badgeClass(status.transportConnected);
  const source = document.getElementById("source");
  source.textContent = status.sourceStatus;
  source.className = lesUi.badgeClass(status.sourceStatus);
});

document.getElementById("group-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("group-code");
  await lesUi.send("les:connection:set-group", { groupCode: input.value });
  input.value = "";
});
