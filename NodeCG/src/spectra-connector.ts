import { io, Socket } from "socket.io-client";
import type { ConnectorState } from "./types";

export interface SpectraConnectorOptions {
  endpoint: string | null;
  path: string;
  initialGroupCode: string | null;
  onPayload: (payload: string) => void;
  onState: (state: ConnectorState) => void;
}

export class SpectraConnector {
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private logonTimer: NodeJS.Timeout | null = null;
  private epoch = 0;
  private attempt = 0;
  private stopped = false;
  private groupCode: string | null;
  private readonly endpoint: string | null;
  private readonly path: string;
  private readonly onPayload: (payload: string) => void;
  private readonly onState: (state: ConnectorState) => void;

  constructor(options: SpectraConnectorOptions) {
    this.endpoint = validateEndpoint(options.endpoint);
    this.path = validatePath(options.path);
    this.groupCode = normalizeGroupCode(options.initialGroupCode);
    this.onPayload = options.onPayload;
    this.onState = options.onState;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  setGroupCode(groupCode: string): void {
    const normalized = normalizeGroupCode(groupCode);
    if (!normalized) throw new Error("Le code de groupe Spectra doit contenir 1 a 64 caracteres autorises.");
    this.groupCode = normalized;
    this.attempt = 0;
    this.disconnectCurrent();
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.disconnectCurrent();
    this.emitState("stopped", false, false, null);
  }

  private connect(): void {
    if (this.stopped) return;
    if (!this.endpoint || !this.groupCode) {
      this.emitState("waiting-configuration", false, false, null);
      return;
    }

    const epoch = ++this.epoch;
    this.emitState(this.attempt === 0 ? "connecting" : "reconnecting", false, false, null);
    const socket = io(this.endpoint, {
      path: this.path,
      autoConnect: false,
      reconnection: false,
      timeout: 10_000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      if (epoch !== this.epoch) return;
      this.attempt = 0;
      this.emitState("transport-connected", true, false, null);
      socket.emit("logon", JSON.stringify({ groupCode: this.groupCode }));
      this.clearLogonTimer();
      this.logonTimer = setTimeout(() => {
        if (epoch !== this.epoch || this.stopped) return;
        this.emitState("reconnecting", true, false, "logon_success non recu sous 10 s");
        this.disconnectSocketOnly();
        this.scheduleReconnect(epoch);
      }, 10_000);
    });

    socket.on("logon_success", () => {
      if (epoch !== this.epoch) return;
      this.clearLogonTimer();
      this.emitState("subscribed", true, true, null);
    });

    socket.on("match_data", (payload: unknown) => {
      if (epoch !== this.epoch) return;
      if (typeof payload !== "string") {
        this.emitState("subscribed", true, true, "match_data non textuel refuse");
        return;
      }
      this.onPayload(payload);
    });

    socket.on("connect_error", (error: Error) => {
      if (epoch !== this.epoch) return;
      this.emitState("reconnecting", false, false, safeError(error));
      this.scheduleReconnect(epoch);
    });

    socket.on("disconnect", (reason) => {
      if (epoch !== this.epoch || this.stopped) return;
      this.clearLogonTimer();
      this.emitState("reconnecting", false, false, `transport ferme: ${String(reason).slice(0, 120)}`);
      this.scheduleReconnect(epoch);
    });

    socket.connect();
  }

  private scheduleReconnect(epoch: number): void {
    if (this.reconnectTimer || this.stopped || epoch !== this.epoch) return;
    this.attempt += 1;
    const base = Math.min(30_000, 1_000 * 2 ** Math.min(this.attempt - 1, 5));
    const jitter = Math.round(base * 0.15 * Math.random());
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (epoch !== this.epoch || this.stopped) return;
      this.disconnectSocketOnly();
      this.connect();
    }, base + jitter);
  }

  private disconnectCurrent(): void {
    this.epoch += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearLogonTimer();
    this.disconnectSocketOnly();
  }

  private disconnectSocketOnly(): void {
    if (!this.socket) return;
    this.clearLogonTimer();
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  private clearLogonTimer(): void {
    if (this.logonTimer) clearTimeout(this.logonTimer);
    this.logonTimer = null;
  }

  private emitState(
    phase: ConnectorState["phase"],
    connected: boolean,
    subscribed: boolean,
    lastError: string | null,
  ): void {
    this.onState({
      phase,
      connected,
      subscribed,
      attempt: this.attempt,
      groupHint: maskGroupCode(this.groupCode),
      lastError,
      changedAt: Date.now(),
    });
  }
}

function validateEndpoint(endpoint: string | null): string | null {
  if (!endpoint) return null;
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("LES_SPECTRA_ENDPOINT doit utiliser http ou https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Les identifiants ne doivent pas etre places dans LES_SPECTRA_ENDPOINT.");
  }
  return parsed.origin;
}

function validatePath(path: string): string {
  if (!path.startsWith("/") || path.includes("..") || path.length > 120) {
    throw new Error("LES_SPECTRA_PATH invalide.");
  }
  return path;
}

export function normalizeGroupCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(normalized) ? normalized : null;
}

function maskGroupCode(groupCode: string | null): string | null {
  if (!groupCode) return null;
  if (groupCode.length <= 2) return "••";
  return `${"•".repeat(Math.min(6, groupCode.length - 2))}${groupCode.slice(-2)}`;
}

function safeError(error: Error): string {
  return String(error?.message || "erreur Socket.IO").slice(0, 180);
}
