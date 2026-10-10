import { randomUUID } from "node:crypto";
import type NodeCG from "nodecg/types";
import { adaptSpectraSnapshot } from "./adapter";
import { applyPresentationCommand, defaultPresentation } from "./presentation";
import { SnapshotBuffer } from "./snapshot-buffer";
import { normalizeGroupCode, SpectraConnector } from "./spectra-connector";
import type {
  CapabilityState,
  ConnectionStatus,
  ConnectorState,
  DiagnosticsState,
  MatchView,
  NormalizedMatchBase,
  PresentationState,
} from "./types";

const quietAfterMs = 15_000;
const staleAfterDisconnectMs = 15_000;

export = (nodecg: NodeCG.ServerAPI): void => {
  const now = Date.now();
  const endpoint = process.env.LES_SPECTRA_ENDPOINT?.trim() || null;
  const path = process.env.LES_SPECTRA_PATH?.trim() || "/socket.io";
  const initialGroup = normalizeGroupCode(process.env.LES_SPECTRA_GROUP_CODE);
  const profile = safeLabel(process.env.LES_SPECTRA_PROFILE || "production");
  const allowedAssetHosts = new Set(
    (process.env.LES_SPECTRA_ASSET_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

  const connectionRep = nodecg.Replicant<ConnectionStatus>("connection-status", {
    persistent: false,
    defaultValue: defaultConnectionStatus(profile, Boolean(endpoint), path, now),
  });
  const matchRep = nodecg.Replicant<MatchView | null>("match-view", {
    persistent: false,
    defaultValue: null,
  });
  const presentationRep = nodecg.Replicant<PresentationState>("presentation", {
    persistent: true,
    defaultValue: defaultPresentation(now),
  });
  const diagnosticsRep = nodecg.Replicant<DiagnosticsState>("diagnostics", {
    persistent: false,
    defaultValue: defaultDiagnostics(now),
  });

  const restored = presentationRep.value || defaultPresentation(now);
  presentationRep.value = {
    ...restored,
    revision: restored.revision + 1,
    program: {
      ...restored.program,
      visible: false,
      emergencyClear: true,
      replaySuppressed: false,
      modules: { ...restored.program.modules },
    },
    preview: { ...restored.preview, modules: { ...restored.preview.modules } },
    updatedAt: now,
  };

  let sessionId = randomUUID();
  let localRevision = 0;
  let lastFingerprint = "";
  let connectorState: ConnectorState | null = null;
  let lastPacketAt: number | null = null;
  let lastChangeAt: number | null = null;
  let disconnectedAt: number | null = null;
  const seenCommandIds = new Set<string>();
  const commandOrder: string[] = [];

  const buffer = new SnapshotBuffer<{ value: NormalizedMatchBase; receivedAt: number }>((entry) => {
    localRevision += 1;
    lastChangeAt = Date.now();
    matchRep.value = {
      ...entry.value,
      sessionId,
      revision: localRevision,
      receivedAt: entry.receivedAt,
      publishedAt: lastChangeAt,
    };
    diagnosticsRep.value = {
      ...diagnosticsRep.value,
      snapshotsPublished: diagnosticsRep.value.snapshotsPublished + 1,
      delayedQueueDepth: buffer.depth,
      updatedAt: Date.now(),
    };
    publishConnectionStatus();
  });
  buffer.setDelay(presentationRep.value.program.delayMs);

  let connector: SpectraConnector;
  try {
    connector = new SpectraConnector({
      endpoint,
      path,
      initialGroupCode: initialGroup,
      onPayload: receivePayload,
      onState: receiveConnectorState,
    });
  } catch (error) {
    const message = safeError(error);
    nodecg.log.error(`Configuration Spectra refusee: ${message}`);
    connectionRep.value = {
      ...connectionRep.value,
      phase: "waiting-configuration",
      sourceStatus: "invalid",
      lastError: message,
      updatedAt: Date.now(),
    };
    diagnosticsRep.value = {
      ...diagnosticsRep.value,
      lastError: message,
      updatedAt: Date.now(),
    };
    return;
  }

  nodecg.listenFor("les:connection:set-group", (data: unknown, ack?: NodeCG.Acknowledgement) => {
    try {
      if (!endpoint) throw new Error("LES_SPECTRA_ENDPOINT n'est pas configure cote extension.");
      if (!isRecord(data) || typeof data.groupCode !== "string") {
        throw new Error("Code de groupe absent.");
      }
      const groupCode = normalizeGroupCode(data.groupCode);
      if (!groupCode) throw new Error("Code de groupe invalide.");
      resetLiveSession();
      connector.setGroupCode(groupCode);
      acknowledge(ack, null, { ok: true, groupHint: maskGroupCode(groupCode) });
    } catch (error) {
      acknowledge(ack, safeError(error));
    }
  });

  nodecg.listenFor("les:presentation:command", (data: unknown, ack?: NodeCG.Acknowledgement) => {
    try {
      if (!isRecord(data) || typeof data.id !== "string") throw new Error("Commande invalide.");
      if (seenCommandIds.has(data.id)) {
        acknowledge(ack, null, { ok: true, duplicate: true, revision: presentationRep.value.revision });
        return;
      }
      const next = applyPresentationCommand(presentationRep.value, data);
      rememberCommand(data.id);
      presentationRep.value = next;
      buffer.setDelay(next.program.delayMs);
      diagnosticsRep.value = {
        ...diagnosticsRep.value,
        delayedQueueDepth: buffer.depth,
        updatedAt: Date.now(),
      };
      acknowledge(ack, null, { ok: true, duplicate: false, revision: next.revision });
    } catch (error) {
      acknowledge(ack, safeError(error));
    }
  });

  const freshnessTimer = setInterval(() => {
    publishConnectionStatus();
    if (diagnosticsRep.value.delayedQueueDepth !== buffer.depth) {
      diagnosticsRep.value = {
        ...diagnosticsRep.value,
        delayedQueueDepth: buffer.depth,
        updatedAt: Date.now(),
      };
    }
  }, 1_000);
  freshnessTimer.unref();

  connector.start();
  nodecg.log.info(
    `LES Valorant pret; profil=${profile}, endpoint=${endpoint ? "configure" : "absent"}, integration live a qualifier.`,
  );

  function receivePayload(payload: string): void {
    const receivedAt = Date.now();
    lastPacketAt = receivedAt;
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch {
      recordInvalidPayload("match_data n'est pas un JSON valide", Buffer.byteLength(payload));
      return;
    }

    const result = adaptSpectraSnapshot(raw, { allowedAssetHosts });
    if (!result.value) {
      recordInvalidPayload(result.warnings.join("; "), Buffer.byteLength(payload));
      diagnosticsRep.value = {
        ...diagnosticsRep.value,
        missingFields: result.missingFields,
        warnings: result.warnings,
        capabilities: result.capabilities,
        updatedAt: receivedAt,
      };
      return;
    }

    const fingerprint = JSON.stringify(result.value);
    const duplicate = fingerprint === lastFingerprint;
    lastFingerprint = fingerprint;
    diagnosticsRep.value = {
      ...diagnosticsRep.value,
      packetsReceived: diagnosticsRep.value.packetsReceived + 1,
      duplicateSnapshots: diagnosticsRep.value.duplicateSnapshots + (duplicate ? 1 : 0),
      lastPayloadBytes: Buffer.byteLength(payload),
      missingFields: result.missingFields,
      warnings: result.warnings,
      capabilities: result.capabilities,
      lastError: null,
      updatedAt: receivedAt,
    };

    if (!duplicate && !buffer.enqueue({ value: result.value, receivedAt })) {
      diagnosticsRep.value = {
        ...diagnosticsRep.value,
        warnings: [...diagnosticsRep.value.warnings, "Tampon de delai plein; snapshot abandonne"].slice(-100),
        lastError: "Tampon de delai plein",
        updatedAt: receivedAt,
      };
    }
    publishConnectionStatus();
  }

  function receiveConnectorState(state: ConnectorState): void {
    connectorState = state;
    if (state.connected) disconnectedAt = null;
    else if (disconnectedAt === null) disconnectedAt = Date.now();
    publishConnectionStatus();
  }

  function publishConnectionStatus(): void {
    const time = Date.now();
    const connected = connectorState?.connected ?? false;
    const subscribed = connectorState?.subscribed ?? false;
    let sourceStatus: ConnectionStatus["sourceStatus"];
    if (!endpoint || connectorState?.phase === "waiting-configuration") {
      sourceStatus = "unconfigured";
    } else if (connected && !lastPacketAt) {
      sourceStatus = "waiting-source";
    } else if (!connected && lastPacketAt) {
      sourceStatus = disconnectedAt && time - disconnectedAt >= staleAfterDisconnectMs ? "stale" : "quiet";
    } else if (lastPacketAt && connected && time - lastPacketAt >= quietAfterMs) {
      sourceStatus = "quiet";
    } else if (lastPacketAt) {
      sourceStatus = "live";
    } else {
      sourceStatus = "waiting-source";
    }

    connectionRep.value = {
      profile,
      endpointConfigured: Boolean(endpoint),
      protocol: "socket.io-4.8.1",
      namespace: "/",
      path,
      phase: connectorState?.phase ?? "waiting-configuration",
      transportConnected: connected,
      subscriptionAcknowledged: subscribed,
      sourceStatus,
      groupHint: connectorState?.groupHint ?? null,
      attempt: connectorState?.attempt ?? 0,
      lastPacketAt,
      lastChangeAt,
      lastError: connectorState?.lastError ?? diagnosticsRep.value.lastError,
      updatedAt: time,
    };
  }

  function recordInvalidPayload(message: string, bytes: number): void {
    diagnosticsRep.value = {
      ...diagnosticsRep.value,
      packetsReceived: diagnosticsRep.value.packetsReceived + 1,
      invalidPayloads: diagnosticsRep.value.invalidPayloads + 1,
      lastPayloadBytes: bytes,
      lastError: message.slice(0, 240),
      updatedAt: Date.now(),
    };
    connectionRep.value = {
      ...connectionRep.value,
      sourceStatus: "invalid",
      lastPacketAt,
      lastError: message.slice(0, 240),
      updatedAt: Date.now(),
    };
  }

  function resetLiveSession(): void {
    buffer.clear();
    sessionId = randomUUID();
    localRevision = 0;
    lastFingerprint = "";
    lastPacketAt = null;
    lastChangeAt = null;
    disconnectedAt = null;
    matchRep.value = null;
    diagnosticsRep.value = {
      ...defaultDiagnostics(Date.now()),
      integrationQualification: diagnosticsRep.value.integrationQualification,
    };
  }

  function rememberCommand(id: string): void {
    seenCommandIds.add(id);
    commandOrder.push(id);
    if (commandOrder.length > 200) {
      const oldest = commandOrder.shift();
      if (oldest) seenCommandIds.delete(oldest);
    }
  }
};

function defaultConnectionStatus(
  profile: string,
  endpointConfigured: boolean,
  path: string,
  now: number,
): ConnectionStatus {
  return {
    profile,
    endpointConfigured,
    protocol: "socket.io-4.8.1",
    namespace: "/",
    path,
    phase: "waiting-configuration",
    transportConnected: false,
    subscriptionAcknowledged: false,
    sourceStatus: endpointConfigured ? "waiting-source" : "unconfigured",
    groupHint: null,
    attempt: 0,
    lastPacketAt: null,
    lastChangeAt: null,
    lastError: null,
    updatedAt: now,
  };
}

function defaultDiagnostics(now: number): DiagnosticsState {
  return {
    integrationQualification: "real-integration-to-verify",
    packetsReceived: 0,
    snapshotsPublished: 0,
    duplicateSnapshots: 0,
    invalidPayloads: 0,
    delayedQueueDepth: 0,
    lastPayloadBytes: null,
    missingFields: [],
    warnings: [],
    capabilities: emptyCapabilities(),
    lastError: null,
    updatedAt: now,
  };
}

function emptyCapabilities(): CapabilityState {
  return {
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
  };
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40) || "production";
}

function safeError(error: unknown): string {
  return String(error instanceof Error ? error.message : error).slice(0, 240);
}

function maskGroupCode(groupCode: string): string {
  if (groupCode.length <= 2) return "••";
  return `${"•".repeat(Math.min(6, groupCode.length - 2))}${groupCode.slice(-2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function acknowledge(
  ack: NodeCG.Acknowledgement | undefined,
  error?: string | null,
  result?: unknown,
): void {
  if (ack && !ack.handled) ack(error, result);
}
