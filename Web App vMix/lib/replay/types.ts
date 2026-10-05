export const REPLAY_SCHEMA_VERSION = 1 as const;
export const REPLAY_CHANNEL_ID = "stream-replay" as const;

export type ReplayMarkerCorner = "top-left" | "top-right";
export type ReplayMarkerVisibility = "hidden" | "entering" | "visible" | "exiting";

export type ReplayMarkerPlacement = {
  corner: ReplayMarkerCorner;
  offsetX: number;
  offsetY: number;
};

export type ReplayMarkerDraft = {
  revision: number;
  placement: ReplayMarkerPlacement;
  updatedAtUtc: string;
};

export type ReplayMarkerSnapshot = {
  revision: number;
  sourceDraftRevision: number;
  placement: ReplayMarkerPlacement;
  capturedAtUtc: string;
};

export type ReplayState = {
  schemaVersion: typeof REPLAY_SCHEMA_VERSION;
  channel: typeof REPLAY_CHANNEL_ID;
  revision: number;
  draft: ReplayMarkerDraft;
  preview: ReplayMarkerSnapshot;
  program: ReplayMarkerSnapshot;
  previewRevision: number;
  programRevision: number;
  visibility: ReplayMarkerVisibility;
  transitionStartedAtUtcMs: number | null;
  lastCommandId: string | null;
  updatedAtUtc: string;
};

export type ReplayStateEnvelope = {
  serverTimeUtcMs: number;
  state: ReplayState;
};

export type ReplayCommand =
  | {
      id: string;
      type: "marker.draft.update";
      expectedRevision: number;
      placement: ReplayMarkerPlacement;
    }
  | {
      id: string;
      type: "marker.preview.prepare";
      expectedDraftRevision: number;
    }
  | {
      id: string;
      type: "marker.program.publish";
      expectedPreviewRevision: number;
    }
  | { id: string; type: "marker.show" }
  | { id: string; type: "marker.hide" }
  | { id: string; type: "marker.hide.immediate" };

export type ReplayCommandResult = {
  accepted: boolean;
  duplicate?: boolean;
  commandId: string;
  commandType?: ReplayCommand["type"];
  stateRevision: number;
  message: string;
  state: ReplayState;
};

export class ReplayCommandError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "invalid_replay_command") {
    super(message);
    this.name = "ReplayCommandError";
    this.status = status;
    this.code = code;
  }
}
