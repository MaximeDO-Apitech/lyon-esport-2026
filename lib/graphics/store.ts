import { getD1 } from "../../db";
import { seedPresets, templateById, templates } from "./registry";
import { applyGraphicsCommand, createInitialState, normalizeGraphicsState } from "./state";
import {
  CHANNEL_ID,
  GraphicsCommandError,
  type CommandResult,
  type GraphicsCommand,
  type GraphicsState,
  type GraphicsStateEnvelope,
  type OutputId,
  type Preset,
  type RendererAck,
} from "./types";
import { validateContent, validatePresetExport } from "./validation";

let initialization: Promise<void> | null = null;

async function initializeStore() {
  if (initialization) return initialization;
  initialization = (async () => {
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS graphics_state (
        channel TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS graphics_presets (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        template_version TEXT NOT NULL,
        name TEXT NOT NULL,
        family TEXT NOT NULL,
        content_json TEXT NOT NULL,
        validation_status TEXT NOT NULL,
        resource_revision TEXT NOT NULL,
        locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS graphics_commands (
        id TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS renderer_acks (
        renderer_id TEXT NOT NULL,
        output TEXT NOT NULL,
        revision INTEGER NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (renderer_id, output)
      )`),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_presets_family_name ON graphics_presets(family, name)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_renderer_acks_output ON renderer_acks(output, applied_at)"),
      d1.prepare("PRAGMA optimize"),
    ]);

    const nowMs = Date.now();
    const initial = createInitialState(nowMs);
    await d1
      .prepare("INSERT OR IGNORE INTO graphics_state (channel, revision, state_json, updated_at) VALUES (?, ?, ?, ?)")
      .bind(CHANNEL_ID, initial.revision, JSON.stringify(initial), initial.updatedAtUtc)
      .run();

    for (const preset of seedPresets) {
      await d1
        .prepare(`INSERT OR IGNORE INTO graphics_presets
          (id, template_id, template_version, name, family, content_json, validation_status, resource_revision, locked, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          preset.id,
          preset.templateId,
          preset.templateVersion,
          preset.name,
          preset.family,
          JSON.stringify(preset.content),
          preset.validationStatus,
          preset.resourceRevision,
          preset.locked ? 1 : 0,
          preset.createdAtUtc,
          preset.updatedAtUtc,
        )
        .run();
    }
  })().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

type StateRow = { revision: number; state_json: string };
type PresetRow = {
  id: string;
  template_id: string;
  template_version: string;
  name: string;
  family: "attente" | "synthe";
  content_json: string;
  validation_status: Preset["validationStatus"];
  resource_revision: string;
  locked: number;
  created_at: string;
  updated_at: string;
};
type RendererAckRow = {
  renderer_id: string;
  output: OutputId;
  revision: number;
  applied_at: string;
};

function rowToPreset(row: PresetRow): Preset {
  return {
    id: row.id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    name: row.name,
    family: row.family,
    content: JSON.parse(row.content_json),
    validationStatus: row.validation_status,
    resourceRevision: row.resource_revision,
    locked: Boolean(row.locked),
    createdAtUtc: row.created_at,
    updatedAtUtc: row.updated_at,
  };
}

async function readStateRow() {
  await initializeStore();
  const row = await getD1()
    .prepare("SELECT revision, state_json FROM graphics_state WHERE channel = ?")
    .bind(CHANNEL_ID)
    .first<StateRow>();
  if (!row) throw new Error("État graphique introuvable.");
  return { row, state: JSON.parse(row.state_json) as GraphicsState };
}

async function readPresets() {
  const result = await getD1()
    .prepare("SELECT * FROM graphics_presets ORDER BY family ASC, locked DESC, name COLLATE NOCASE ASC")
    .all<PresetRow>();
  return result.results.map((row: PresetRow) => rowToPreset(row));
}

async function readRendererAcks() {
  const result = await getD1()
    .prepare("SELECT renderer_id, output, revision, applied_at FROM renderer_acks ORDER BY applied_at DESC LIMIT 24")
    .all<RendererAckRow>();
  return result.results.map<RendererAck>((row) => ({
    rendererId: row.renderer_id,
    output: row.output,
    revision: row.revision,
    appliedAtUtc: row.applied_at,
  }));
}

export async function getGraphicsStateEnvelope(nowMs = Date.now()): Promise<GraphicsStateEnvelope> {
  const [{ state }, presets, rendererAcks] = await Promise.all([
    readStateRow(),
    initializeStore().then(readPresets),
    initializeStore().then(readRendererAcks),
  ]);
  return {
    serverTimeUtcMs: nowMs,
    state: normalizeGraphicsState(state, nowMs),
    templates,
    presets,
    rendererAcks,
  };
}

async function findCommandResult(id: string) {
  const row = await getD1()
    .prepare("SELECT result_json FROM graphics_commands WHERE id = ?")
    .bind(id)
    .first<{ result_json: string }>();
  return row ? (JSON.parse(row.result_json) as CommandResult) : null;
}

function commandId(command: GraphicsCommand) {
  if (typeof command.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(command.id)) {
    throw new GraphicsCommandError("Identifiant de commande invalide.", 400, "invalid_command_id");
  }
  return command.id;
}

function cleanPresetName(value: unknown) {
  if (typeof value !== "string") throw new GraphicsCommandError("Nom de préréglage invalide.");
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || name.length > 64) throw new GraphicsCommandError("Le nom du préréglage doit contenir entre 1 et 64 caractères.");
  return name;
}

function newPresetId() {
  return `preset-${crypto.randomUUID()}`;
}

async function applyPresetCommand(command: Extract<GraphicsCommand, { type: `preset.${string}` }>, state: GraphicsState, nowMs: number) {
  const d1 = getD1();
  const now = new Date(nowMs).toISOString();
  let preset: Preset;

  if (command.type === "preset.save") {
    const template = templates.find((entry) => entry.family === command.output)!;
    const draft = state[command.output].draft.content;
    preset = {
      id: newPresetId(),
      templateId: template.id,
      templateVersion: template.version,
      name: cleanPresetName(command.name),
      family: command.output,
      content: validateContent(command.output, draft),
      validationStatus: "needs_visual_validation",
      resourceRevision: template.resourceRevision,
      locked: false,
      createdAtUtc: now,
      updatedAtUtc: now,
    };
  } else if (command.type === "preset.import") {
    const imported = validatePresetExport(command.preset);
    const template = templateById.get(imported.templateId)!;
    preset = {
      id: newPresetId(),
      templateId: imported.templateId,
      templateVersion: imported.templateVersion,
      name: imported.name,
      family: template.family,
      content: imported.content,
      validationStatus: "needs_visual_validation",
      resourceRevision: template.resourceRevision,
      locked: false,
      createdAtUtc: now,
      updatedAtUtc: now,
    };
  } else {
    const row = await d1.prepare("SELECT * FROM graphics_presets WHERE id = ?").bind(command.presetId).first<PresetRow>();
    if (!row) throw new GraphicsCommandError("Préréglage introuvable.", 404, "preset_not_found");
    const source = rowToPreset(row);
    if (command.type === "preset.rename") {
      if (source.locked) throw new GraphicsCommandError("Un préréglage fourni ne peut pas être renommé.", 409, "preset_locked");
      await d1.prepare("UPDATE graphics_presets SET name = ?, updated_at = ?, validation_status = ? WHERE id = ?")
        .bind(cleanPresetName(command.name), now, "needs_visual_validation", source.id).run();
      preset = { ...source, name: cleanPresetName(command.name), validationStatus: "needs_visual_validation", updatedAtUtc: now };
      return preset;
    }
    preset = {
      ...source,
      id: newPresetId(),
      name: cleanPresetName(command.name),
      locked: false,
      validationStatus: "needs_visual_validation",
      createdAtUtc: now,
      updatedAtUtc: now,
    };
  }

  await d1.prepare(`INSERT INTO graphics_presets
    (id, template_id, template_version, name, family, content_json, validation_status, resource_revision, locked, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      preset.id,
      preset.templateId,
      preset.templateVersion,
      preset.name,
      preset.family,
      JSON.stringify(preset.content),
      preset.validationStatus,
      preset.resourceRevision,
      preset.locked ? 1 : 0,
      preset.createdAtUtc,
      preset.updatedAtUtc,
    ).run();
  return preset;
}

export async function executeGraphicsCommand(command: GraphicsCommand, nowMs = Date.now()): Promise<CommandResult> {
  await initializeStore();
  const id = commandId(command);
  const duplicate = await findCommandResult(id);
  if (duplicate) return { ...duplicate, duplicate: true };

  const { row, state } = await readStateRow();
  let nextState = state;
  let preset: Preset | undefined;
  let message = "Commande acceptée.";

  if (command.type.startsWith("preset.")) {
    preset = await applyPresetCommand(
      command as Extract<GraphicsCommand, { type: `preset.${string}` }>,
      normalizeGraphicsState(state, nowMs),
      nowMs,
    );
    message = "Préréglage enregistré.";
  } else {
    nextState = applyGraphicsCommand(state, command, nowMs);
    const update = await getD1()
      .prepare("UPDATE graphics_state SET revision = ?, state_json = ?, updated_at = ? WHERE channel = ? AND revision = ?")
      .bind(nextState.revision, JSON.stringify(nextState), nextState.updatedAtUtc, CHANNEL_ID, row.revision)
      .run();
    if (!update.meta.changes) {
      throw new GraphicsCommandError("L’état a changé sur un autre pupitre. Recharge avant de recommencer.", 409, "state_conflict");
    }
  }

  const result: CommandResult = {
    accepted: true,
    commandId: id,
    stateRevision: nextState.revision,
    message,
    state: normalizeGraphicsState(nextState, nowMs),
    preset,
  };
  await getD1()
    .prepare("INSERT INTO graphics_commands (id, result_json, created_at) VALUES (?, ?, ?)")
    .bind(id, JSON.stringify(result), new Date(nowMs).toISOString())
    .run();
  return result;
}

export async function acknowledgeRenderer(ack: RendererAck) {
  await initializeStore();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{3,95}$/.test(ack.rendererId)) {
    throw new GraphicsCommandError("Identifiant de rendu invalide.");
  }
  if (!Number.isInteger(ack.revision) || ack.revision < 0) {
    throw new GraphicsCommandError("Révision de rendu invalide.");
  }
  await getD1().prepare(`INSERT INTO renderer_acks (renderer_id, output, revision, applied_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(renderer_id, output) DO UPDATE SET revision = excluded.revision, applied_at = excluded.applied_at`)
    .bind(ack.rendererId, ack.output, ack.revision, ack.appliedAtUtc)
    .run();
}

export async function checkStoreHealth() {
  await initializeStore();
  const row = await getD1().prepare("SELECT revision FROM graphics_state WHERE channel = ?").bind(CHANNEL_ID).first<{ revision: number }>();
  return { storage: "d1" as const, revision: row?.revision ?? 0 };
}
