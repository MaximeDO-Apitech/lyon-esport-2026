import type { ModuleVisibility, PresentationState, PresentationSurface } from "./types";

export const defaultModules: ModuleVisibility = {
  score: true,
  players: false,
  observed: false,
  series: true,
  spike: true,
};

export function defaultPresentation(now = Date.now()): PresentationState {
  const compact: PresentationSurface = {
    visible: false,
    emergencyClear: true,
    replaySuppressed: false,
    mode: "compact",
    delayMs: 0,
    autoHideOnDisconnect: true,
    modules: { ...defaultModules },
  };
  return {
    revision: 0,
    program: compact,
    preview: {
      ...compact,
      visible: true,
      emergencyClear: false,
      autoHideOnDisconnect: false,
      modules: { ...compact.modules },
    },
    lastCommandId: null,
    updatedAt: now,
  };
}

export function applyPresentationCommand(
  state: PresentationState,
  command: unknown,
  now = Date.now(),
): PresentationState {
  if (!isRecord(command)) throw new Error("Commande de presentation invalide.");
  const id = safeId(command.id);
  const action = typeof command.action === "string" ? command.action : "";
  if (!id || !action) throw new Error("Commande sans identifiant ou action.");
  if (id === state.lastCommandId) return state;

  const next = cloneState(state);
  switch (action) {
    case "program.show":
      next.program.visible = true;
      next.program.emergencyClear = false;
      break;
    case "program.hide":
      next.program.visible = false;
      break;
    case "program.emergency-clear":
      next.program.visible = false;
      next.program.emergencyClear = true;
      break;
    case "program.replay":
      next.program.replaySuppressed = requiredBoolean(command.value);
      break;
    case "program.mode":
      next.program.mode = requiredMode(command.value);
      next.program.modules.players = next.program.mode === "full";
      next.program.modules.observed = next.program.mode === "full";
      break;
    case "program.delay":
      next.program.delayMs = boundedDelay(command.value);
      break;
    case "program.auto-hide":
      next.program.autoHideOnDisconnect = requiredBoolean(command.value);
      break;
    case "program.modules":
      next.program.modules = parseModules(command.value, next.program.modules);
      break;
    case "preview.mode":
      next.preview.mode = requiredMode(command.value);
      next.preview.modules.players = next.preview.mode === "full";
      next.preview.modules.observed = next.preview.mode === "full";
      break;
    case "preview.modules":
      next.preview.modules = parseModules(command.value, next.preview.modules);
      break;
    case "preview.publish":
      next.program = {
        ...next.program,
        mode: next.preview.mode,
        modules: { ...next.preview.modules },
        visible: false,
        emergencyClear: false,
      };
      break;
    default:
      throw new Error(`Action inconnue: ${action.slice(0, 80)}`);
  }

  next.revision += 1;
  next.lastCommandId = id;
  next.updatedAt = now;
  return next;
}

function cloneState(state: PresentationState): PresentationState {
  return {
    ...state,
    program: { ...state.program, modules: { ...state.program.modules } },
    preview: { ...state.preview, modules: { ...state.preview.modules } },
  };
}

function parseModules(value: unknown, fallback: ModuleVisibility): ModuleVisibility {
  if (!isRecord(value)) throw new Error("Liste de modules invalide.");
  const next = { ...fallback };
  for (const key of Object.keys(next) as (keyof ModuleVisibility)[]) {
    if (key in value) next[key] = requiredBoolean(value[key]);
  }
  return next;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Valeur booleenne attendue.");
  return value;
}

function requiredMode(value: unknown): "compact" | "full" {
  if (value !== "compact" && value !== "full") throw new Error("Mode HUD invalide.");
  return value;
}

function boundedDelay(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Delai invalide.");
  return Math.max(0, Math.min(15_000, Math.round(value)));
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string" || !/^[a-zA-Z0-9:_-]{8,100}$/.test(value)) return null;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
