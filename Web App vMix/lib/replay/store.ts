import { getD1 } from "../../db";
import { applyReplayCommand, createInitialReplayState, normalizeReplayState } from "./state";
import {
  REPLAY_CHANNEL_ID,
  ReplayCommandError,
  type ReplayCommand,
  type ReplayCommandResult,
  type ReplayState,
  type ReplayStateEnvelope,
} from "./types";

let initialization: Promise<void> | null = null;

async function initializeReplayStore() {
  if (initialization) return initialization;
  initialization = (async () => {
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS replay_marker_state (
        channel TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS replay_marker_commands (
        id TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      d1.prepare("PRAGMA optimize"),
    ]);
    const initial = createInitialReplayState();
    await d1.prepare("INSERT OR IGNORE INTO replay_marker_state (channel, revision, state_json, updated_at) VALUES (?, ?, ?, ?)")
      .bind(REPLAY_CHANNEL_ID, initial.revision, JSON.stringify(initial), initial.updatedAtUtc)
      .run();
  })().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

type StateRow = { revision: number; state_json: string };

async function readReplayStateRow() {
  await initializeReplayStore();
  const row = await getD1().prepare("SELECT revision, state_json FROM replay_marker_state WHERE channel = ?")
    .bind(REPLAY_CHANNEL_ID)
    .first<StateRow>();
  if (!row) throw new Error("État replay introuvable.");
  return { row, state: JSON.parse(row.state_json) as ReplayState };
}

export async function getReplayStateEnvelope(nowMs = Date.now()): Promise<ReplayStateEnvelope> {
  const { state } = await readReplayStateRow();
  return { serverTimeUtcMs: nowMs, state: normalizeReplayState(state, nowMs) };
}

function commandId(command: ReplayCommand) {
  if (typeof command.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(command.id)) {
    throw new ReplayCommandError("Identifiant de commande replay invalide.", 400, "invalid_replay_command_id");
  }
  return command.id;
}

async function findCommandResult(id: string) {
  const row = await getD1().prepare("SELECT result_json FROM replay_marker_commands WHERE id = ?")
    .bind(id)
    .first<{ result_json: string }>();
  return row ? JSON.parse(row.result_json) as ReplayCommandResult : null;
}

export async function executeReplayCommand(command: ReplayCommand, nowMs = Date.now()): Promise<ReplayCommandResult> {
  await initializeReplayStore();
  const id = commandId(command);
  const duplicate = await findCommandResult(id);
  if (duplicate) return { ...duplicate, duplicate: true };

  const { row, state } = await readReplayStateRow();
  const next = applyReplayCommand(state, command, nowMs);
  const update = await getD1().prepare(
    "UPDATE replay_marker_state SET revision = ?, state_json = ?, updated_at = ? WHERE channel = ? AND revision = ?",
  ).bind(next.revision, JSON.stringify(next), next.updatedAtUtc, REPLAY_CHANNEL_ID, row.revision).run();

  if (!update.meta.changes) {
    throw new ReplayCommandError("L’état replay a changé sur un autre pupitre.", 409, "replay_state_conflict");
  }

  const result: ReplayCommandResult = {
    accepted: true,
    commandId: id,
    stateRevision: next.revision,
    message: "Commande replay acceptée.",
    state: normalizeReplayState(next, nowMs),
  };
  await getD1().prepare("INSERT INTO replay_marker_commands (id, result_json, created_at) VALUES (?, ?, ?)")
    .bind(id, JSON.stringify(result), new Date(nowMs).toISOString())
    .run();
  return result;
}
