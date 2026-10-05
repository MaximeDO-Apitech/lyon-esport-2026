import { getD1 } from "../../db";
import { getGraphicsStateEnvelope } from "../graphics/store";
import type { CommandResult, RendererOutputId } from "../graphics/types";
import { getReplayStateEnvelope } from "../replay/store";
import type { ReplayCommandResult } from "../replay/types";
import { classifyRendererOutput } from "./health";
import type {
  OperationsCommandEntry,
  OperationsStatusReport,
} from "./types";

type CommandRow = {
  id: string;
  result_json: string;
  created_at: string;
};

const COMMAND_LABELS: Record<string, string> = {
  "draft.update": "Brouillon graphique mis à jour",
  "preview.prepare": "Prévisualisation graphique préparée",
  "program.publish": "Programme graphique publié",
  "synthe.show": "Synthé affiché",
  "synthe.hide": "Synthé masqué",
  "synthe.clear": "Synthé vidé immédiatement",
  "timer.configure": "Compteur configuré",
  "timer.start": "Compteur démarré",
  "timer.pause": "Compteur mis en pause",
  "timer.resume": "Compteur repris",
  "timer.reset": "Compteur réinitialisé",
  "timer.digits.show": "Chiffres du compteur affichés",
  "timer.digits.hide": "Chiffres du compteur masqués",
  "preset.save": "Préréglage enregistré",
  "preset.duplicate": "Préréglage dupliqué",
  "preset.rename": "Préréglage renommé",
  "preset.import": "Préréglage importé",
  "marker.draft.update": "Position du marqueur modifiée",
  "marker.preview.prepare": "Marqueur prévisualisé",
  "marker.program.publish": "Position du marqueur publiée",
  "marker.show": "Marqueur replay affiché",
  "marker.hide": "Marqueur replay masqué",
  "marker.hide.immediate": "Marqueur replay masqué immédiatement",
};

function parseCommand(
  row: CommandRow,
  source: OperationsCommandEntry["source"],
): OperationsCommandEntry {
  let result: Partial<CommandResult & ReplayCommandResult> = {};
  try {
    result = JSON.parse(row.result_json) as Partial<CommandResult & ReplayCommandResult>;
  } catch {
    // Une ancienne ligne illisible reste visible sans casser toute la supervision.
  }
  const type = result.commandType ?? "commande";
  return {
    id: row.id,
    source,
    type,
    label: COMMAND_LABELS[type] ?? "Commande appliquée",
    stateRevision: typeof result.stateRevision === "number" ? result.stateRevision : null,
    createdAtUtc: row.created_at,
  };
}

export async function getOperationsStatus(nowMs = Date.now()): Promise<OperationsStatusReport> {
  const [graphics, replay] = await Promise.all([
    getGraphicsStateEnvelope(nowMs),
    getReplayStateEnvelope(nowMs),
  ]);
  const d1 = getD1();
  const [graphicsRows, replayRows] = await Promise.all([
    d1.prepare("SELECT id, result_json, created_at FROM graphics_commands ORDER BY created_at DESC LIMIT 8").all<CommandRow>(),
    d1.prepare("SELECT id, result_json, created_at FROM replay_marker_commands ORDER BY created_at DESC LIMIT 8").all<CommandRow>(),
  ]);

  const definitions: Array<{
    id: RendererOutputId;
    label: string;
    path: string;
    expectedRevision: number;
  }> = [
    {
      id: "attente",
      label: "Écran d’attente",
      path: "/output/attente",
      expectedRevision: graphics.state.attente.programRevision,
    },
    {
      id: "synthe",
      label: "Synthé",
      path: "/output/synthe",
      expectedRevision: graphics.state.synthe.programRevision,
    },
    {
      id: "replay-marker",
      label: "Marqueur replay",
      path: "/output/replay-marker",
      expectedRevision: replay.state.programRevision,
    },
  ];

  const outputs = definitions.map((definition) => classifyRendererOutput({
    ...definition,
    acks: graphics.rendererAcks,
    nowMs,
  }));
  const checks = outputs
    .filter((output) => output.level !== "ok")
    .map((output) => ({
      id: `output-${output.id}`,
      label: output.label,
      level: output.level,
      detail: output.detail,
    }));
  const recentCommands = [
    ...graphicsRows.results.map((row) => parseCommand(row, "graphics")),
    ...replayRows.results.map((row) => parseCommand(row, "replay")),
  ]
    .sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc))
    .slice(0, 10);

  return {
    ok: !checks.some((check) => check.level === "error"),
    generatedAtUtc: new Date(nowMs).toISOString(),
    refreshAfterMs: 5_000,
    storage: {
      engine: "d1",
      graphicsRevision: graphics.state.revision,
      replayRevision: replay.state.revision,
    },
    program: {
      waitingMessage: graphics.state.attente.program?.content.message ?? null,
      timerStatus: graphics.state.timer.status,
      lowerThirdVisibility: graphics.state.synthe.visibility,
      replayMarkerVisibility: replay.state.visibility,
    },
    outputs,
    checks,
    recentCommands,
  };
}
