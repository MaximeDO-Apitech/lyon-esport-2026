const frame = document.getElementById("preview");
const status = document.getElementById("preview-status");

function openPreview(fixture) {
  const params = new URLSearchParams({ surface: "preview" });
  if (fixture) params.set("fixture", "synthetic");
  frame.src = `../graphics/hud.html?${params}`;
  status.textContent = fixture ? "fixture isolee" : "telemetrie live";
  status.className = fixture ? "badge warn" : "badge ok";
}

document.getElementById("show-live").addEventListener("click", () => openPreview(false));
document.getElementById("show-fixture").addEventListener("click", () => openPreview(true));
openPreview(true);
