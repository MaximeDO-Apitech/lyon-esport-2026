export type Availability = "valid" | "unknown" | "unsupported";
export type ScreenPosition = "left" | "right";
export type CompetitiveSide = "attack" | "defense" | "unknown";

export interface NormalizedPlayer {
  id: string | null;
  renderKey: string;
  order: number;
  name: string | null;
  fullName: string | null;
  agent: string | null;
  alive: boolean | null;
  observed: boolean;
  hasSpike: boolean | null;
  health: number | null;
  weapon: string | null;
  armor: string | null;
  credits: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  ultimate: {
    current: number | null;
    required: number | null;
    ready: boolean | null;
  };
  abilities: {
    grenade: number | null;
    ability1: number | null;
    ability2: number | null;
  };
  availability: {
    health: Availability;
    abilities: Availability;
    stats: Availability;
    loadout: Availability;
  };
}

export interface NormalizedTeam {
  identityKey: "spectra-left-team" | "spectra-right-team";
  position: ScreenPosition;
  name: string | null;
  tricode: string | null;
  logoUrl: string | null;
  side: CompetitiveSide;
  score: number | null;
  seriesScore: number | null;
  players: NormalizedPlayer[];
}

export interface NormalizedMatchBase {
  source: "spectra";
  sourceVersion: "server-0.3.5/frontend-0.3.6-contract";
  running: boolean | null;
  round: number | null;
  phase: string | null;
  map: string | null;
  teams: [NormalizedTeam, NormalizedTeam];
  observedPlayerId: string | null;
  spike: {
    planted: boolean | null;
    defused: boolean | null;
    detonated: boolean | null;
  };
  series: {
    mapsNeeded: number | null;
    tournamentName: string | null;
  };
}

export interface MatchView extends NormalizedMatchBase {
  sessionId: string;
  revision: number;
  receivedAt: number;
  publishedAt: number;
}

export interface AdapterResult {
  value: NormalizedMatchBase | null;
  missingFields: string[];
  warnings: string[];
  capabilities: CapabilityState;
}

export interface CapabilityState {
  identity: boolean;
  teams: boolean;
  agents: boolean;
  score: boolean;
  round: boolean;
  phase: boolean;
  observedPlayer: boolean;
  health: boolean;
  abilities: boolean;
  stats: boolean;
  loadout: boolean;
  spike: boolean;
  series: boolean;
  roundTimer: false;
  mapban: false;
  playercams: false;
}

export interface ConnectorState {
  phase:
    | "waiting-configuration"
    | "connecting"
    | "transport-connected"
    | "subscribed"
    | "reconnecting"
    | "stopped";
  connected: boolean;
  subscribed: boolean;
  attempt: number;
  groupHint: string | null;
  lastError: string | null;
  changedAt: number;
}

export interface ConnectionStatus {
  profile: string;
  endpointConfigured: boolean;
  protocol: "socket.io-4.8.1";
  namespace: "/";
  path: string;
  phase: ConnectorState["phase"];
  transportConnected: boolean;
  subscriptionAcknowledged: boolean;
  sourceStatus: "unconfigured" | "waiting-source" | "live" | "quiet" | "stale" | "invalid";
  groupHint: string | null;
  attempt: number;
  lastPacketAt: number | null;
  lastChangeAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

export interface ModuleVisibility {
  score: boolean;
  players: boolean;
  observed: boolean;
  series: boolean;
  spike: boolean;
}

export interface PresentationSurface {
  visible: boolean;
  emergencyClear: boolean;
  replaySuppressed: boolean;
  mode: "compact" | "full";
  delayMs: number;
  autoHideOnDisconnect: boolean;
  modules: ModuleVisibility;
}

export interface PresentationState {
  revision: number;
  program: PresentationSurface;
  preview: PresentationSurface;
  lastCommandId: string | null;
  updatedAt: number;
}

export interface DiagnosticsState {
  integrationQualification: "real-integration-to-verify" | "live-qualified";
  packetsReceived: number;
  snapshotsPublished: number;
  duplicateSnapshots: number;
  invalidPayloads: number;
  delayedQueueDepth: number;
  lastPayloadBytes: number | null;
  missingFields: string[];
  warnings: string[];
  capabilities: CapabilityState;
  lastError: string | null;
  updatedAt: number;
}
