export const GRAPHICS_SCHEMA_VERSION = 1;
export const CHANNEL_ID = "stream" as const;
export const EVENT_TIME_ZONE = "Europe/Paris" as const;

export type OutputId = "attente" | "synthe";
export type RendererOutputId = OutputId | "replay-marker";
export type TemplateFamily = OutputId;
export type ValidationStatus =
  | "missing_resources"
  | "needs_visual_validation"
  | "validated";

export type ResourceStatus = "available" | "missing";

export type TemplateResource = {
  id: string;
  label: string;
  path: string;
  status: ResourceStatus;
  required: boolean;
  integritySha256?: string;
};

export type ParameterDefinition = {
  key: string;
  label: string;
  type: "text" | "boolean" | "select" | "number" | "datetime";
  required?: boolean;
  maxLength?: number;
  options?: Array<{ label: string; value: string }>;
};

export type GraphicTemplate = {
  id: string;
  version: string;
  name: string;
  family: TemplateFamily;
  description: string;
  width: 1920;
  height: 1080;
  transparent: boolean;
  parameters: ParameterDefinition[];
  resources: TemplateResource[];
  thumbnail: string;
  validationStatus: ValidationStatus;
  resourceRevision: string;
};

export type WaitingContent = {
  message: string;
  countdownEnabled: boolean;
};

export type LowerThirdContent = {
  name: string;
  role: string;
  organization: string;
};

export type ContentByOutput = {
  attente: WaitingContent;
  synthe: LowerThirdContent;
};

export type RevisionedDraft<T> = {
  revision: number;
  content: T;
  updatedAtUtc: string;
};

export type GraphicSnapshot<T> = {
  templateId: string;
  templateVersion: string;
  revision: number;
  sourceDraftRevision: number;
  content: T;
  capturedAtUtc: string;
};

export type OutputState<T> = {
  draft: RevisionedDraft<T>;
  preview: GraphicSnapshot<T> | null;
  program: GraphicSnapshot<T> | null;
  previewRevision: number;
  programRevision: number;
};

export type LowerThirdVisibility =
  | "hidden"
  | "entering"
  | "visible"
  | "exiting";

export type LowerThirdState = OutputState<LowerThirdContent> & {
  visibility: LowerThirdVisibility;
  transitionStartedAtUtcMs: number | null;
  pendingProgram: GraphicSnapshot<LowerThirdContent> | null;
};

export type TimerMode = "duration" | "target";
export type TimerStatus = "idle" | "running" | "paused" | "completed";

export type TimerConfiguration = {
  mode: TimerMode;
  durationSeconds: number;
  targetUtcMs: number | null;
  timeZone: typeof EVENT_TIME_ZONE;
};

export type ProgramTimer = {
  revision: number;
  configuration: TimerConfiguration;
  status: TimerStatus;
  endAtUtcMs: number | null;
  remainingMsAtPause: number | null;
  showDigits: boolean;
};

export type GraphicsState = {
  schemaVersion: typeof GRAPHICS_SCHEMA_VERSION;
  channel: typeof CHANNEL_ID;
  revision: number;
  attente: OutputState<WaitingContent>;
  synthe: LowerThirdState;
  timer: ProgramTimer;
  lastCommandId: string | null;
  updatedAtUtc: string;
};

export type RendererAck = {
  rendererId: string;
  output: RendererOutputId;
  revision: number;
  appliedAtUtc: string;
};

export type Preset = {
  id: string;
  templateId: string;
  templateVersion: string;
  name: string;
  family: TemplateFamily;
  content: WaitingContent | LowerThirdContent;
  validationStatus: ValidationStatus;
  resourceRevision: string;
  locked: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type GraphicsStateEnvelope = {
  serverTimeUtcMs: number;
  state: GraphicsState;
  templates: GraphicTemplate[];
  presets: Preset[];
  rendererAcks: RendererAck[];
};

export type GraphicsCommand =
  | {
      id: string;
      type: "draft.update";
      output: OutputId;
      expectedRevision: number;
      content: WaitingContent | LowerThirdContent;
    }
  | {
      id: string;
      type: "preview.prepare";
      output: OutputId;
      expectedDraftRevision: number;
    }
  | {
      id: string;
      type: "program.publish";
      output: OutputId;
      expectedPreviewRevision: number;
    }
  | { id: string; type: "synthe.show" }
  | { id: string; type: "synthe.hide" }
  | { id: string; type: "synthe.clear" }
  | {
      id: string;
      type: "timer.configure";
      configuration: TimerConfiguration;
    }
  | { id: string; type: "timer.start" }
  | { id: string; type: "timer.pause" }
  | { id: string; type: "timer.resume" }
  | { id: string; type: "timer.reset" }
  | { id: string; type: "timer.digits.show" }
  | { id: string; type: "timer.digits.hide" }
  | {
      id: string;
      type: "preset.save";
      output: OutputId;
      name: string;
    }
  | {
      id: string;
      type: "preset.duplicate";
      presetId: string;
      name: string;
    }
  | {
      id: string;
      type: "preset.rename";
      presetId: string;
      name: string;
    }
  | {
      id: string;
      type: "preset.import";
      preset: PresetExport;
    };

export type PresetExport = {
  schemaVersion: 1;
  templateId: string;
  templateVersion: string;
  name: string;
  content: WaitingContent | LowerThirdContent;
};

export type CommandResult = {
  accepted: boolean;
  duplicate?: boolean;
  commandId: string;
  commandType?: GraphicsCommand["type"];
  stateRevision: number;
  message: string;
  state?: GraphicsState;
  preset?: Preset;
};

export class GraphicsCommandError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "invalid_command") {
    super(message);
    this.name = "GraphicsCommandError";
    this.status = status;
    this.code = code;
  }
}
