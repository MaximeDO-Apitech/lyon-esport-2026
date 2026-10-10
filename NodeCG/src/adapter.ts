import type {
  AdapterResult,
  Availability,
  CapabilityState,
  CompetitiveSide,
  NormalizedMatchBase,
  NormalizedPlayer,
  NormalizedTeam,
  ScreenPosition,
} from "./types";

interface AdapterOptions {
  allowedAssetHosts: ReadonlySet<string>;
}

export function adaptSpectraSnapshot(raw: unknown, options: AdapterOptions): AdapterResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(raw)) {
    return emptyResult("payload");
  }

  const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];
  if (rawTeams.length < 2) {
    return emptyResult("teams[0..1]");
  }
  if (rawTeams.length > 2) warnings.push("teams: seuls les deux emplacements officiels sont publies");

  const series = isRecord(raw.tools) && isRecord(raw.tools.seriesInfo) ? raw.tools.seriesInfo : null;
  const tournament = isRecord(raw.tools) && isRecord(raw.tools.tournamentInfo)
    ? raw.tools.tournamentInfo
    : null;

  const left = adaptTeam(rawTeams[0], "left", series, options, missingFields, warnings);
  const right = adaptTeam(rawTeams[1], "right", series, options, missingFields, warnings);
  const allPlayers = [...left.players, ...right.players];
  const observed = allPlayers.filter((player) => player.observed);
  if (observed.length > 1) warnings.push("players.isObserved: plusieurs joueurs observes; selection retiree");

  const spike = isRecord(raw.spikeState) ? raw.spikeState : null;
  const value: NormalizedMatchBase = {
    source: "spectra",
    sourceVersion: "server-0.3.5/frontend-0.3.6-contract",
    running: nullableBoolean(raw.isRunning, "isRunning", missingFields),
    round: nullableInteger(raw.roundNumber, "roundNumber", missingFields, 0, 200),
    phase: nullableString(raw.roundPhase, "roundPhase", missingFields, 48),
    map: nullableString(raw.map, "map", missingFields, 80),
    teams: [left, right],
    observedPlayerId: observed.length === 1 ? observed[0].id : null,
    spike: {
      planted: nullableBoolean(spike?.planted, "spikeState.planted", missingFields),
      defused: nullableBoolean(spike?.defused, "spikeState.defused", missingFields),
      detonated: nullableBoolean(spike?.detonated, "spikeState.detonated", missingFields),
    },
    series: {
      mapsNeeded: nullableInteger(series?.needed, "tools.seriesInfo.needed", missingFields, 0, 9),
      tournamentName: nullableString(
        tournament?.name,
        "tools.tournamentInfo.name",
        missingFields,
        100,
      ),
    },
  };

  return {
    value,
    missingFields: unique(missingFields),
    warnings: unique(warnings),
    capabilities: deriveCapabilities(value),
  };
}

function adaptTeam(
  raw: unknown,
  position: ScreenPosition,
  series: Record<string, unknown> | null,
  options: AdapterOptions,
  missing: string[],
  warnings: string[],
): NormalizedTeam {
  const team = isRecord(raw) ? raw : {};
  const prefix = `teams[${position === "left" ? 0 : 1}]`;
  const players = Array.isArray(team.players) ? team.players.slice(0, 5) : [];
  if (Array.isArray(team.players) && team.players.length > 5) {
    warnings.push(`${prefix}.players: plus de cinq joueurs; surplus ignore`);
  }
  if (players.length < 5) missing.push(`${prefix}.players[${players.length}..4]`);
  const logo = nullableString(team.teamUrl, `${prefix}.teamUrl`, missing, 2_048);

  return {
    identityKey: position === "left" ? "spectra-left-team" : "spectra-right-team",
    position,
    name: nullableString(team.teamName, `${prefix}.teamName`, missing, 80),
    tricode: nullableString(team.teamTricode, `${prefix}.teamTricode`, missing, 16),
    logoUrl: allowAssetUrl(logo, options.allowedAssetHosts, `${prefix}.teamUrl`, warnings),
    side: competitiveSide(team.isAttacking, `${prefix}.isAttacking`, missing),
    score: nullableInteger(team.roundsWon, `${prefix}.roundsWon`, missing, 0, 100),
    seriesScore: nullableInteger(
      position === "left" ? series?.wonLeft : series?.wonRight,
      `tools.seriesInfo.${position === "left" ? "wonLeft" : "wonRight"}`,
      missing,
      0,
      9,
    ),
    players: players.map((player, index) => adaptPlayer(player, prefix, index, missing)),
  };
}

function adaptPlayer(
  raw: unknown,
  teamPrefix: string,
  index: number,
  missing: string[],
): NormalizedPlayer {
  const player = isRecord(raw) ? raw : {};
  const prefix = `${teamPrefix}.players[${index}]`;
  const id = nullableId(player.playerId, `${prefix}.playerId`, missing);
  const auxiliary = isRecord(player.auxiliaryAvailable) ? player.auxiliaryAvailable : {};
  const healthAvailable = auxiliary.health === true;
  const abilitiesAvailable = auxiliary.abilities === true;
  const scoreboardAvailable = player.scoreboardAvailable === true || auxiliary.scoreboard === true;
  const abilities = isRecord(player.abilities) ? player.abilities : {};

  return {
    id,
    renderKey: id ? `spectra-player:${id}` : `${teamPrefix}:unknown-slot-${index}`,
    order: index,
    name: nullableString(player.name, `${prefix}.name`, missing, 60),
    fullName: nullableString(player.fullName, `${prefix}.fullName`, missing, 96),
    agent: nullableString(player.agentInternal, `${prefix}.agentInternal`, missing, 64),
    alive: nullableBoolean(player.isAlive, `${prefix}.isAlive`, missing),
    observed: player.isObserved === true,
    hasSpike: nullableBoolean(player.hasSpike, `${prefix}.hasSpike`, missing),
    health: healthAvailable
      ? nullableInteger(player.health, `${prefix}.health`, missing, 0, 200)
      : null,
    weapon: scoreboardAvailable
      ? nullableString(player.highestWeapon, `${prefix}.highestWeapon`, missing, 80)
      : null,
    armor: scoreboardAvailable
      ? nullableString(player.armorName, `${prefix}.armorName`, missing, 48)
      : null,
    credits: scoreboardAvailable
      ? nullableInteger(player.money, `${prefix}.money`, missing, 0, 99_999)
      : null,
    kills: scoreboardAvailable
      ? nullableInteger(player.kills, `${prefix}.kills`, missing, 0, 999)
      : null,
    deaths: scoreboardAvailable
      ? nullableInteger(player.deaths, `${prefix}.deaths`, missing, 0, 999)
      : null,
    assists: scoreboardAvailable
      ? nullableInteger(player.assists, `${prefix}.assists`, missing, 0, 999)
      : null,
    ultimate: {
      current: scoreboardAvailable
        ? nullableInteger(player.currUltPoints, `${prefix}.currUltPoints`, missing, 0, 20)
        : null,
      required: scoreboardAvailable
        ? nullableInteger(player.maxUltPoints, `${prefix}.maxUltPoints`, missing, 0, 20)
        : null,
      ready: scoreboardAvailable
        ? nullableBoolean(player.ultReady, `${prefix}.ultReady`, missing)
        : null,
    },
    abilities: {
      grenade: abilitiesAvailable
        ? nullableInteger(abilities.grenade, `${prefix}.abilities.grenade`, missing, 0, 20)
        : null,
      ability1: abilitiesAvailable
        ? nullableInteger(abilities.ability1, `${prefix}.abilities.ability1`, missing, 0, 20)
        : null,
      ability2: abilitiesAvailable
        ? nullableInteger(abilities.ability2, `${prefix}.abilities.ability2`, missing, 0, 20)
        : null,
    },
    availability: {
      health: availability(healthAvailable),
      abilities: availability(abilitiesAvailable),
      stats: availability(scoreboardAvailable),
      loadout: availability(scoreboardAvailable),
    },
  };
}

function deriveCapabilities(value: NormalizedMatchBase): CapabilityState {
  const players = value.teams.flatMap((team) => team.players);
  return {
    identity: value.teams.some((team) => Boolean(team.name || team.tricode)),
    teams: value.teams.length === 2,
    agents: players.some((player) => Boolean(player.agent)),
    score: value.teams.every((team) => team.score !== null),
    round: value.round !== null,
    phase: value.phase !== null,
    observedPlayer: value.observedPlayerId !== null,
    health: players.some((player) => player.availability.health === "valid"),
    abilities: players.some((player) => player.availability.abilities === "valid"),
    stats: players.some((player) => player.availability.stats === "valid"),
    loadout: players.some((player) => player.availability.loadout === "valid"),
    spike: Object.values(value.spike).some((state) => state !== null),
    series: value.series.mapsNeeded !== null,
    roundTimer: false,
    mapban: false,
    playercams: false,
  };
}

function emptyResult(field: string): AdapterResult {
  return {
    value: null,
    missingFields: [field],
    warnings: ["Snapshot Spectra refuse: structure minimale absente"],
    capabilities: {
      identity: false,
      teams: false,
      agents: false,
      score: false,
      round: false,
      phase: false,
      observedPlayer: false,
      health: false,
      abilities: false,
      stats: false,
      loadout: false,
      spike: false,
      series: false,
      roundTimer: false,
      mapban: false,
      playercams: false,
    },
  };
}

function availability(available: boolean): Availability {
  return available ? "valid" : "unknown";
}

function competitiveSide(value: unknown, path: string, missing: string[]): CompetitiveSide {
  if (value === true) return "attack";
  if (value === false) return "defense";
  missing.push(path);
  return "unknown";
}

function nullableString(
  value: unknown,
  path: string,
  missing: string[],
  maxLength: number,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    missing.push(path);
    return null;
  }
  return value.trim().slice(0, maxLength);
}

function nullableId(value: unknown, path: string, missing: string[]): string | null {
  if ((typeof value === "string" || typeof value === "number") && String(value).trim() !== "") {
    return String(value).trim().slice(0, 128);
  }
  missing.push(path);
  return null;
}

function nullableInteger(
  value: unknown,
  path: string,
  missing: string[],
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    missing.push(path);
    return null;
  }
  return value;
}

function nullableBoolean(value: unknown, path: string, missing: string[]): boolean | null {
  if (typeof value !== "boolean") {
    missing.push(path);
    return null;
  }
  return value;
}

function allowAssetUrl(
  value: string | null,
  allowedHosts: ReadonlySet<string>,
  path: string,
  warnings: string[],
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) {
      warnings.push(`${path}: ressource distante masquee (hote non autorise)`);
      return null;
    }
    return url.href;
  } catch {
    warnings.push(`${path}: URL de ressource invalide`);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].slice(0, 100);
}
