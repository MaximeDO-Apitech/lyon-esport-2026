import { templateById } from "./registry";
import {
  EVENT_TIME_ZONE,
  GraphicsCommandError,
  type LowerThirdContent,
  type OutputId,
  type PresetExport,
  type TimerConfiguration,
  type WaitingContent,
} from "./types";

function cleanText(value: unknown, field: string, maxLength: number, required = false) {
  if (typeof value !== "string") {
    throw new GraphicsCommandError(`${field} doit être un texte.`, 400, "invalid_text");
  }
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (required && !cleaned) {
    throw new GraphicsCommandError(`${field} est obligatoire.`, 400, "required_field");
  }
  if (cleaned.length > maxLength) {
    throw new GraphicsCommandError(
      `${field} dépasse la limite de ${maxLength} caractères.`,
      400,
      "text_too_long",
    );
  }
  return cleaned;
}

export function validateWaitingContent(input: unknown): WaitingContent {
  const value = (input ?? {}) as Partial<WaitingContent>;
  return {
    message: cleanText(value.message, "Le message", 42, true).toLocaleUpperCase("fr-FR"),
    countdownEnabled: value.countdownEnabled !== false,
  };
}

export function validateLowerThirdContent(input: unknown): LowerThirdContent {
  const value = (input ?? {}) as Partial<LowerThirdContent>;
  return {
    name: cleanText(value.name, "Le nom ou pseudonyme", 36, true),
    role: cleanText(value.role ?? "", "La fonction", 48),
    organization: cleanText(value.organization ?? "", "L’organisation", 48),
  };
}

export function validateDraftContent(output: OutputId, input: unknown) {
  if (output === "attente") {
    const value = (input ?? {}) as Partial<WaitingContent>;
    return {
      message: cleanText(value.message ?? "", "Le message", 42).toLocaleUpperCase("fr-FR"),
      countdownEnabled: value.countdownEnabled !== false,
    } satisfies WaitingContent;
  }
  const value = (input ?? {}) as Partial<LowerThirdContent>;
  return {
    name: cleanText(value.name ?? "", "Le nom ou pseudonyme", 36),
    role: cleanText(value.role ?? "", "La fonction", 48),
    organization: cleanText(value.organization ?? "", "L’organisation", 48),
  } satisfies LowerThirdContent;
}

export function validateContent(output: OutputId, input: unknown) {
  return output === "attente"
    ? validateWaitingContent(input)
    : validateLowerThirdContent(input);
}

export function assertTemplatePublishable(templateId: string) {
  const template = templateById.get(templateId);
  if (!template) {
    throw new GraphicsCommandError("Modèle introuvable.", 404, "template_not_found");
  }
  const missing = template.resources.filter((resource) => resource.required && resource.status === "missing");
  if (missing.length) {
    throw new GraphicsCommandError(
      `Publication bloquée : ressources manquantes (${missing.map((resource) => resource.label).join(", ")}).`,
      409,
      "missing_resources",
    );
  }
  return template;
}

export function validateTimerConfiguration(input: unknown): TimerConfiguration {
  const value = (input ?? {}) as Partial<TimerConfiguration>;
  const mode = value.mode === "target" ? "target" : value.mode === "duration" ? "duration" : null;
  if (!mode) {
    throw new GraphicsCommandError("Mode de compteur invalide.", 400, "invalid_timer_mode");
  }
  const durationSeconds = Math.round(Number(value.durationSeconds));
  const targetUtcMs = value.targetUtcMs === null ? null : Number(value.targetUtcMs);
  if (mode === "duration" && (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 7 * 24 * 3600)) {
    throw new GraphicsCommandError("La durée doit être comprise entre 1 seconde et 7 jours.", 400, "invalid_duration");
  }
  if (mode === "target" && (!Number.isFinite(targetUtcMs) || Number(targetUtcMs) <= 0)) {
    throw new GraphicsCommandError("L’heure cible est invalide.", 400, "invalid_target");
  }
  return {
    mode,
    durationSeconds: mode === "duration" ? durationSeconds : Math.max(1, durationSeconds || 900),
    targetUtcMs: mode === "target" ? Number(targetUtcMs) : null,
    timeZone: EVENT_TIME_ZONE,
  };
}

export function validatePresetExport(input: unknown): PresetExport {
  const value = (input ?? {}) as Partial<PresetExport>;
  if (value.schemaVersion !== 1) {
    throw new GraphicsCommandError("Version de préréglage non prise en charge.", 400, "invalid_preset_version");
  }
  if (typeof value.templateId !== "string" || typeof value.templateVersion !== "string") {
    throw new GraphicsCommandError("Référence de modèle invalide.", 400, "invalid_template_reference");
  }
  const template = templateById.get(value.templateId);
  if (!template || template.version !== value.templateVersion) {
    throw new GraphicsCommandError("Le modèle ou sa version n’existe pas dans cette bibliothèque.", 400, "template_not_found");
  }
  return {
    schemaVersion: 1,
    templateId: template.id,
    templateVersion: template.version,
    name: cleanText(value.name, "Le nom du préréglage", 64, true),
    content: validateContent(template.family, value.content),
  };
}
