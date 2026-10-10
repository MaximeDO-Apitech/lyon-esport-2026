(() => {
  const params = new URLSearchParams(location.search);
  const isPreview = params.get("surface") === "preview";
  const useFixture = isPreview && params.get("fixture") === "synthetic";
  const backdrop = params.get("backdrop");
  const stage = document.getElementById("stage");
  const hud = document.getElementById("hud");
  const matchRep = nodecg.Replicant("match-view");
  const presentationRep = nodecg.Replicant("presentation");
  const connectionRep = nodecg.Replicant("connection-status");
  let match = null;
  let presentation = null;
  let connection = null;

  const rails = {
    left: createRail(document.getElementById("rail-left"), "left"),
    right: createRail(document.getElementById("rail-right"), "right"),
  };

  if (backdrop === "reference") {
    const image = document.getElementById("reference-backdrop");
    image.src = "fixtures/reference-gameplay.jpg";
    stage.classList.add("has-backdrop");
  }

  resize();
  addEventListener("resize", resize);

  presentationRep.on("change", (value) => {
    presentation = value;
    render();
  });
  connectionRep.on("change", (value) => {
    connection = value;
    render();
  });

  if (useFixture) {
    fetch("fixtures/synthetic-match.json", { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => {
        match = value;
        connection = { sourceStatus: "live" };
        render();
      })
      .catch(() => {
        match = null;
        render();
      });
  } else {
    matchRep.on("change", (value) => {
      match = value;
      render();
    });
  }

  function render() {
    const surface = presentation?.[isPreview ? "preview" : "program"];
    if (!surface) return;
    const stale = connection?.sourceStatus === "stale" || connection?.sourceStatus === "invalid";
    const hiddenBySource = stale && surface.autoHideOnDisconnect;
    const visible = Boolean(match && surface.visible && !surface.emergencyClear && !surface.replaySuppressed && !hiddenBySource);
    stage.classList.toggle("is-visible", visible);
    stage.classList.toggle("is-emergency", surface.emergencyClear);
    stage.classList.toggle("mode-compact", surface.mode === "compact");
    stage.classList.toggle("mode-full", surface.mode === "full");
    stage.classList.toggle("source-stale", stale);
    hud.setAttribute("aria-hidden", String(!visible));

    setModule("scoreboard", surface.modules.score);
    setModule("rail-left", surface.modules.players && surface.mode === "full");
    setModule("rail-right", surface.modules.players && surface.mode === "full");
    setModule("observed-card", surface.modules.observed && Boolean(match?.observedPlayerId));
    document.getElementById("series-line").classList.toggle("is-disabled", !surface.modules.series);
    document.getElementById("spike-status").classList.toggle("is-disabled", !surface.modules.spike);
    if (!match) return;

    renderTeam(match.teams[0], document.getElementById("team-left"), rails.left);
    renderTeam(match.teams[1], document.getElementById("team-right"), rails.right);
    setText("match-phase", match.phase || "—");
    setText("match-map", match.map || "—");
    setText("match-round", match.round === null ? "MANCHE —" : `MANCHE ${match.round}`);
    setText("series-line", seriesLabel(match));
    setText("spike-status", surface.modules.spike ? spikeLabel(match.spike) : "");
    renderObserved(match);
  }

  function renderTeam(team, element, slots) {
    element.dataset.side = team.side;
    setTextWithin(element, ".team-name", team.name || team.tricode || "—");
    setTextWithin(element, ".team-side", sideLabel(team.side));
    setTextWithin(element, ".score-value", team.score === null ? "—" : String(team.score));
    const logo = element.querySelector(".team-logo");
    if (team.logoUrl) {
      if (logo.src !== team.logoUrl) logo.src = team.logoUrl;
      logo.alt = team.name ? `Logo ${team.name}` : "Logo equipe";
    } else {
      logo.removeAttribute("src");
      logo.alt = "";
    }
    for (let index = 0; index < slots.length; index += 1) updatePlayerSlot(slots[index], team.players[index], team.side);
  }

  function renderObserved(currentMatch) {
    const player = currentMatch.teams.flatMap((team) => team.players).find((candidate) => candidate.id === currentMatch.observedPlayerId);
    if (!player) return;
    setText("observed-agent", shortAgent(player.agent));
    setText("observed-name", player.name || "—");
    setText("observed-loadout", player.availability.loadout === "valid" ? [player.weapon, player.armor].filter(Boolean).join(" · ") || "—" : "Equipement inconnu");
    setText("observed-health", player.availability.health === "valid" && player.health !== null ? `${player.health} PV` : "PV —");
    setText("observed-stats", player.availability.stats === "valid" ? `${value(player.kills)} K · ${value(player.deaths)} D · ${value(player.assists)} A · ULT ${value(player.ultimate.current)}/${value(player.ultimate.required)}` : "Statistiques indisponibles");
  }

  function createRail(element, position) {
    const slots = [];
    for (let index = 0; index < 5; index += 1) {
      const card = document.createElement("article");
      card.className = "player-card";
      card.innerHTML = `<div class="agent-token">—</div><div class="player-copy"><div class="player-name">—</div><div class="player-detail">—</div></div><div class="player-state">—<small>—</small></div>`;
      card.dataset.position = position;
      element.appendChild(card);
      slots.push(card);
    }
    return slots;
  }

  function updatePlayerSlot(card, player, side) {
    card.dataset.side = side;
    card.hidden = !player;
    if (!player) return;
    card.dataset.key = player.renderKey;
    card.classList.toggle("is-dead", player.alive === false);
    card.classList.toggle("is-observed", player.observed);
    setTextWithin(card, ".agent-token", shortAgent(player.agent));
    setTextWithin(card, ".player-name", player.name || "—");
    const detail = player.availability.loadout === "valid" ? [player.weapon, player.credits === null ? null : `${player.credits} CR`].filter(Boolean).join(" · ") : "Equipement inconnu";
    setTextWithin(card, ".player-detail", detail);
    const state = card.querySelector(".player-state");
    const stateMain = player.alive === false ? "MORT" : player.availability.health === "valid" && player.health !== null ? `${player.health} PV` : player.alive === true ? "VIVANT" : "ETAT —";
    const stats = player.availability.stats === "valid" ? `${value(player.kills)}/${value(player.deaths)}/${value(player.assists)}` : "KDA —";
    updateStateNode(state, stateMain, stats);
  }

  function updateStateNode(element, main, sub) {
    const text = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (text && text.nodeValue !== main) text.nodeValue = main;
    const small = element.querySelector("small");
    if (small.textContent !== sub) small.textContent = sub;
  }

  function seriesLabel(currentMatch) {
    const left = currentMatch.teams[0];
    const right = currentMatch.teams[1];
    const parts = [];
    if (currentMatch.series.tournamentName) parts.push(currentMatch.series.tournamentName);
    if (currentMatch.series.mapsNeeded > 0) parts.push(`BO${currentMatch.series.mapsNeeded * 2 - 1}`);
    if (left.seriesScore !== null && right.seriesScore !== null) parts.push(`CARTES ${left.seriesScore} — ${right.seriesScore}`);
    return parts.join("  /  ") || "—";
  }

  function spikeLabel(spike) {
    if (spike.detonated) return "SPIKE EXPLOSE";
    if (spike.defused) return "SPIKE DESAMORCE";
    if (spike.planted) return "SPIKE POSE";
    return "";
  }

  function sideLabel(side) {
    if (side === "attack") return "ATQ · ATTAQUE";
    if (side === "defense") return "DEF · DEFENSE";
    return "COTE INCONNU";
  }

  function shortAgent(agent) {
    if (!agent) return "—";
    const cleaned = agent.replace(/[^a-zA-Z0-9]/g, "");
    return cleaned.slice(0, 3).toUpperCase() || "—";
  }

  function value(input) { return input === null || input === undefined ? "—" : String(input); }
  function setModule(id, enabled) { document.getElementById(id).classList.toggle("is-disabled", !enabled); }
  function setText(id, text) { const element = document.getElementById(id); if (element && element.textContent !== text) element.textContent = text; }
  function setTextWithin(parent, selector, text) { const element = parent.querySelector(selector); if (element.textContent !== text) element.textContent = text; }
  function resize() {
    const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
})();
