import { getTemplateForOutput } from "./registry";
import {
  CHANNEL_ID,
  EVENT_TIME_ZONE,
  GRAPHICS_SCHEMA_VERSION,
  GraphicsCommandError,
  type GraphicSnapshot,
  type GraphicsCommand,
  type GraphicsState,
  type LowerThirdContent,
  type OutputId,
  type WaitingContent,
} from "./types";
import {
  assertTemplatePublishable,
  validateContent,
  validateDraftContent,
  validateTimerConfiguration,
} from "./validation";

const SYNTH_ENTER_MS = 400;
const SYNTH_EXIT_MS = 300;

function iso(nowMs: number) {
  return new Date(nowMs).toISOString();
}

export function createInitialState(nowMs = Date.now()): GraphicsState {
  const now = iso(nowMs);
  const waitingTemplate = getTemplateForOutput("attente");
  const initialWaiting = { message: "LE LIVE COMMENCE BIENTÔT", countdownEnabled: true };
  const initialWaitingSnapshot: GraphicSnapshot<WaitingContent> = {
    templateId: waitingTemplate.id,
    templateVersion: waitingTemplate.version,
    revision: 1,
    sourceDraftRevision: 1,
    content: initialWaiting,
    capturedAtUtc: now,
  };

  return {
    schemaVersion: GRAPHICS_SCHEMA_VERSION,
    channel: CHANNEL_ID,
    revision: 1,
    attente: {
      draft: { revision: 1, content: initialWaiting, updatedAtUtc: now },
      preview: initialWaitingSnapshot,
      program: initialWaitingSnapshot,
      previewRevision: 1,
      programRevision: 1,
    },
    synthe: {
      draft: {
        revision: 1,
        content: { name: "", role: "", organization: "" },
        updatedAtUtc: now,
      },
      preview: null,
      program: null,
      previewRevision: 0,
      programRevision: 0,
      visibility: "hidden",
      transitionStartedAtUtcMs: null,
      pendingProgram: null,
    },
    timer: {
      revision: 1,
      configuration: {
        mode: "duration",
        durationSeconds: 900,
        targetUtcMs: null,
        timeZone: EVENT_TIME_ZONE,
      },
      status: "idle",
      endAtUtcMs: null,
      remainingMsAtPause: 900_000,
      showDigits: true,
    },
    lastCommandId: null,
    updatedAtUtc: now,
  };
}

function cloneState(state: GraphicsState): GraphicsState {
  return structuredClone(state);
}

export function normalizeGraphicsState(state: GraphicsState, nowMs = Date.now()): GraphicsState {
  const next = cloneState(state);

  if (next.timer.status === "running" && next.timer.endAtUtcMs !== null && next.timer.endAtUtcMs <= nowMs) {
    next.timer.status = "completed";
    next.timer.remainingMsAtPause = 0;
  }

  const startedAt = next.synthe.transitionStartedAtUtcMs;
  if (startedAt !== null && next.synthe.visibility === "entering" && nowMs - startedAt >= SYNTH_ENTER_MS) {
    next.synthe.visibility = "visible";
    next.synthe.transitionStartedAtUtcMs = null;
  }

  if (startedAt !== null && next.synthe.visibility === "exiting" && nowMs - startedAt >= SYNTH_EXIT_MS) {
    if (next.synthe.pendingProgram) {
      next.synthe.program = next.synthe.pendingProgram;
      next.synthe.pendingProgram = null;
      next.synthe.visibility = "entering";
      next.synthe.transitionStartedAtUtcMs = startedAt + SYNTH_EXIT_MS;
      if (nowMs - next.synthe.transitionStartedAtUtcMs >= SYNTH_ENTER_MS) {
        next.synthe.visibility = "visible";
        next.synthe.transitionStartedAtUtcMs = null;
      }
    } else {
      next.synthe.visibility = "hidden";
      next.synthe.transitionStartedAtUtcMs = null;
    }
  }

  return next;
}

function outputState(state: GraphicsState, output: OutputId) {
  return output === "attente" ? state.attente : state.synthe;
}

function snapshotFromDraft(
  output: OutputId,
  revision: number,
  draftRevision: number,
  content: WaitingContent | LowerThirdContent,
  nowMs: number,
) {
  const template = getTemplateForOutput(output);
  return {
    templateId: template.id,
    templateVersion: template.version,
    revision,
    sourceDraftRevision: draftRevision,
    content,
    capturedAtUtc: iso(nowMs),
  };
}

function requireRevision(actual: number, expected: number, label: string) {
  if (!Number.isInteger(expected) || actual !== expected) {
    throw new GraphicsCommandError(
      `${label} périmée : attendu ${expected}, état courant ${actual}. Recharge le pupitre.`,
      409,
      "stale_revision",
    );
  }
}

function initialTimerRemaining(state: GraphicsState, nowMs: number) {
  return state.timer.configuration.mode === "duration"
    ? state.timer.configuration.durationSeconds * 1000
    : Math.max(0, (state.timer.configuration.targetUtcMs ?? nowMs) - nowMs);
}

export function applyGraphicsCommand(
  currentState: GraphicsState,
  command: GraphicsCommand,
  nowMs = Date.now(),
): GraphicsState {
  const state = normalizeGraphicsState(currentState, nowMs);
  const next = cloneState(state);

  switch (command.type) {
    case "draft.update": {
      const output = outputState(next, command.output);
      requireRevision(output.draft.revision, command.expectedRevision, "Révision de brouillon");
      const content = validateDraftContent(command.output, command.content);
      output.draft = {
        revision: output.draft.revision + 1,
        content: content as never,
        updatedAtUtc: iso(nowMs),
      };
      break;
    }

    case "preview.prepare": {
      const output = outputState(next, command.output);
      requireRevision(output.draft.revision, command.expectedDraftRevision, "Révision de brouillon");
      const template = getTemplateForOutput(command.output);
      assertTemplatePublishable(template.id);
      const validatedContent = validateContent(command.output, output.draft.content);
      const revision = output.previewRevision + 1;
      output.preview = snapshotFromDraft(
        command.output,
        revision,
        output.draft.revision,
        validatedContent,
        nowMs,
      ) as never;
      output.previewRevision = revision;
      break;
    }

    case "program.publish": {
      const output = outputState(next, command.output);
      requireRevision(output.previewRevision, command.expectedPreviewRevision, "Révision de prévisualisation");
      if (!output.preview) {
        throw new GraphicsCommandError("Aucune prévisualisation préparée.", 409, "preview_required");
      }
      assertTemplatePublishable(output.preview.templateId);
      const revision = output.programRevision + 1;
      const published = { ...output.preview, revision, capturedAtUtc: iso(nowMs) };
      output.programRevision = revision;

      if (command.output === "synthe") {
        if (next.synthe.visibility === "hidden") {
          next.synthe.program = published as GraphicSnapshot<LowerThirdContent>;
          next.synthe.pendingProgram = null;
        } else {
          next.synthe.pendingProgram = published as GraphicSnapshot<LowerThirdContent>;
          next.synthe.visibility = "exiting";
          next.synthe.transitionStartedAtUtcMs = nowMs;
        }
      } else {
        next.attente.program = published as GraphicSnapshot<WaitingContent>;
      }
      break;
    }

    case "synthe.show": {
      if (!next.synthe.program) {
        throw new GraphicsCommandError("Publie d’abord un synthé avant de l’afficher.", 409, "program_required");
      }
      if (next.synthe.visibility !== "visible" && next.synthe.visibility !== "entering") {
        next.synthe.visibility = "entering";
        next.synthe.transitionStartedAtUtcMs = nowMs;
      }
      break;
    }

    case "synthe.hide": {
      if (next.synthe.visibility !== "hidden" && next.synthe.visibility !== "exiting") {
        next.synthe.pendingProgram = null;
        next.synthe.visibility = "exiting";
        next.synthe.transitionStartedAtUtcMs = nowMs;
      }
      break;
    }

    case "synthe.clear": {
      next.synthe.program = null;
      next.synthe.pendingProgram = null;
      next.synthe.visibility = "hidden";
      next.synthe.transitionStartedAtUtcMs = null;
      next.synthe.programRevision += 1;
      break;
    }

    case "timer.configure": {
      next.timer.configuration = validateTimerConfiguration(command.configuration);
      next.timer.status = "idle";
      next.timer.endAtUtcMs = null;
      next.timer.remainingMsAtPause = initialTimerRemaining(next, nowMs);
      next.timer.revision += 1;
      break;
    }

    case "timer.start": {
      const remaining = initialTimerRemaining(next, nowMs);
      next.timer.endAtUtcMs = nowMs + remaining;
      next.timer.remainingMsAtPause = remaining;
      next.timer.status = remaining > 0 ? "running" : "completed";
      next.timer.revision += 1;
      break;
    }

    case "timer.pause": {
      if (next.timer.status !== "running" || next.timer.endAtUtcMs === null) break;
      next.timer.remainingMsAtPause = Math.max(0, next.timer.endAtUtcMs - nowMs);
      next.timer.endAtUtcMs = null;
      next.timer.status = next.timer.remainingMsAtPause > 0 ? "paused" : "completed";
      next.timer.revision += 1;
      break;
    }

    case "timer.resume": {
      if (next.timer.status !== "paused") break;
      const remaining = Math.max(0, next.timer.remainingMsAtPause ?? 0);
      next.timer.endAtUtcMs = nowMs + remaining;
      next.timer.status = remaining > 0 ? "running" : "completed";
      next.timer.revision += 1;
      break;
    }

    case "timer.reset": {
      next.timer.status = "idle";
      next.timer.endAtUtcMs = null;
      next.timer.remainingMsAtPause = initialTimerRemaining(next, nowMs);
      next.timer.revision += 1;
      break;
    }

    case "timer.digits.show":
      next.timer.showDigits = true;
      next.timer.revision += 1;
      break;

    case "timer.digits.hide":
      next.timer.showDigits = false;
      next.timer.revision += 1;
      break;

    case "preset.save":
    case "preset.duplicate":
    case "preset.rename":
    case "preset.import":
      throw new GraphicsCommandError("Cette commande est gérée par le registre de préréglages.", 500, "command_routing_error");

    default:
      throw new GraphicsCommandError("Commande inconnue.", 400, "unknown_command");
  }

  next.revision += 1;
  next.lastCommandId = command.id;
  next.updatedAtUtc = iso(nowMs);
  return next;
}

export const SYNTH_TRANSITION_DURATIONS = {
  entering: SYNTH_ENTER_MS,
  exiting: SYNTH_EXIT_MS,
} as const;

export function getTimerRemainingMs(state: GraphicsState, serverNowMs: number) {
  if (state.timer.status === "running" && state.timer.endAtUtcMs !== null) {
    return Math.max(0, state.timer.endAtUtcMs - serverNowMs);
  }
  if (state.timer.status === "completed") return 0;
  return Math.max(0, state.timer.remainingMsAtPause ?? initialTimerRemaining(state, serverNowMs));
}
