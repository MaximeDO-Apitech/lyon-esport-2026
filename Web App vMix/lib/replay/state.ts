import { REPLAY_MARKER } from "./config";
import {
  REPLAY_CHANNEL_ID,
  REPLAY_SCHEMA_VERSION,
  ReplayCommandError,
  type ReplayCommand,
  type ReplayMarkerPlacement,
  type ReplayMarkerSnapshot,
  type ReplayState,
} from "./types";

export const DEFAULT_REPLAY_MARKER_PLACEMENT: ReplayMarkerPlacement = {
  ...REPLAY_MARKER.defaultPlacement,
};

export function validateReplayMarkerPlacement(value: ReplayMarkerPlacement): ReplayMarkerPlacement {
  if (value.corner !== "top-left" && value.corner !== "top-right") {
    throw new ReplayCommandError("Coin du marqueur invalide.");
  }
  if (!Number.isInteger(value.offsetX) || value.offsetX < 48 || value.offsetX > 480) {
    throw new ReplayCommandError("Le décalage horizontal doit être un entier entre 48 et 480 px.");
  }
  if (!Number.isInteger(value.offsetY) || value.offsetY < 36 || value.offsetY > 300) {
    throw new ReplayCommandError("Le décalage vertical doit être un entier entre 36 et 300 px.");
  }
  return { corner: value.corner, offsetX: value.offsetX, offsetY: value.offsetY };
}

function snapshot(revision: number, sourceDraftRevision: number, placement: ReplayMarkerPlacement, nowMs: number): ReplayMarkerSnapshot {
  return {
    revision,
    sourceDraftRevision,
    placement: { ...placement },
    capturedAtUtc: new Date(nowMs).toISOString(),
  };
}

export function createInitialReplayState(nowMs = Date.now()): ReplayState {
  const now = new Date(nowMs).toISOString();
  const initial = snapshot(1, 1, DEFAULT_REPLAY_MARKER_PLACEMENT, nowMs);
  return {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    channel: REPLAY_CHANNEL_ID,
    revision: 1,
    draft: { revision: 1, placement: { ...DEFAULT_REPLAY_MARKER_PLACEMENT }, updatedAtUtc: now },
    preview: { ...initial, placement: { ...initial.placement } },
    program: { ...initial, placement: { ...initial.placement } },
    previewRevision: 1,
    programRevision: 1,
    visibility: "hidden",
    transitionStartedAtUtcMs: null,
    lastCommandId: null,
    updatedAtUtc: now,
  };
}

export function normalizeReplayState(state: ReplayState, nowMs = Date.now()): ReplayState {
  if (state.visibility === "entering" && state.transitionStartedAtUtcMs !== null && nowMs - state.transitionStartedAtUtcMs >= REPLAY_MARKER.enterMs) {
    return { ...state, visibility: "visible", transitionStartedAtUtcMs: null };
  }
  if (state.visibility === "exiting" && state.transitionStartedAtUtcMs !== null && nowMs - state.transitionStartedAtUtcMs >= REPLAY_MARKER.exitMs) {
    return { ...state, visibility: "hidden", transitionStartedAtUtcMs: null };
  }
  return state;
}

export function applyReplayCommand(input: ReplayState, command: ReplayCommand, nowMs = Date.now()): ReplayState {
  const state = normalizeReplayState(input, nowMs);
  const base = {
    ...state,
    revision: state.revision + 1,
    lastCommandId: command.id,
    updatedAtUtc: new Date(nowMs).toISOString(),
  };

  switch (command.type) {
    case "marker.draft.update": {
      if (command.expectedRevision !== state.draft.revision) {
        throw new ReplayCommandError("Le brouillon du marqueur a changé. Recharge avant de recommencer.", 409, "replay_draft_conflict");
      }
      return {
        ...base,
        draft: {
          revision: state.draft.revision + 1,
          placement: validateReplayMarkerPlacement(command.placement),
          updatedAtUtc: base.updatedAtUtc,
        },
      };
    }
    case "marker.preview.prepare": {
      if (command.expectedDraftRevision !== state.draft.revision) {
        throw new ReplayCommandError("Le brouillon ne correspond plus à la révision demandée.", 409, "replay_preview_conflict");
      }
      const revision = state.previewRevision + 1;
      return {
        ...base,
        previewRevision: revision,
        preview: snapshot(revision, state.draft.revision, state.draft.placement, nowMs),
      };
    }
    case "marker.program.publish": {
      if (command.expectedPreviewRevision !== state.previewRevision) {
        throw new ReplayCommandError("La prévisualisation ne correspond plus à la révision demandée.", 409, "replay_program_conflict");
      }
      const revision = state.programRevision + 1;
      return {
        ...base,
        programRevision: revision,
        program: snapshot(revision, state.preview.sourceDraftRevision, state.preview.placement, nowMs),
      };
    }
    case "marker.show":
      if (state.visibility === "visible" || state.visibility === "entering") return base;
      return { ...base, visibility: "entering", transitionStartedAtUtcMs: nowMs };
    case "marker.hide":
      if (state.visibility === "hidden" || state.visibility === "exiting") return base;
      return { ...base, visibility: "exiting", transitionStartedAtUtcMs: nowMs };
    case "marker.hide.immediate":
      return { ...base, visibility: "hidden", transitionStartedAtUtcMs: null };
  }
}
