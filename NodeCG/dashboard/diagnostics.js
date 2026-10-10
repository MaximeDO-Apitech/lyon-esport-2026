nodecg.Replicant("diagnostics").on("change", (value) => {
  if (!value) return;
  lesUi.text("qualification", value.integrationQualification);
  lesUi.text("packets", String(value.packetsReceived));
  lesUi.text("published", String(value.snapshotsPublished));
  lesUi.text("duplicates", String(value.duplicateSnapshots));
  lesUi.text("invalid", String(value.invalidPayloads));
  lesUi.text("capabilities", JSON.stringify(value.capabilities, null, 2));
  lesUi.text("missing", value.missingFields.length ? value.missingFields.join("\n") : "Aucun champ absent signale.");
  lesUi.text("warnings", value.warnings.length ? value.warnings.join("\n") : value.lastError || "Aucun avertissement.");
});

nodecg.Replicant("match-view").on("change", (value) => {
  lesUi.text("view", value ? JSON.stringify(value, null, 2) : "Aucun snapshot publie.");
});
