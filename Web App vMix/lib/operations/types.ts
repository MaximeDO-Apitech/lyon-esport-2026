import type { RendererOutputId } from "../graphics/types";

export type OperationsStatusLevel = "ok" | "warn" | "error";

export type OperationsCheck = {
  id: string;
  label: string;
  level: OperationsStatusLevel;
  detail: string;
};

export type OperationsOutputStatus = {
  id: RendererOutputId;
  label: string;
  path: string;
  level: OperationsStatusLevel;
  detail: string;
  expectedRevision: number;
  appliedRevision: number | null;
  connectedRenderers: number;
  lastSeenAtUtc: string | null;
  ageMs: number | null;
};

export type OperationsCommandEntry = {
  id: string;
  source: "graphics" | "replay";
  type: string;
  label: string;
  stateRevision: number | null;
  createdAtUtc: string;
};

export type OperationsStatusReport = {
  ok: boolean;
  generatedAtUtc: string;
  refreshAfterMs: number;
  storage: {
    engine: "d1";
    graphicsRevision: number;
    replayRevision: number;
  };
  program: {
    waitingMessage: string | null;
    timerStatus: string;
    lowerThirdVisibility: string;
    replayMarkerVisibility: string;
  };
  outputs: OperationsOutputStatus[];
  checks: OperationsCheck[];
  recentCommands: OperationsCommandEntry[];
};
