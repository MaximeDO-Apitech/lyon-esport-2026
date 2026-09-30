import type { GraphicTemplate, Preset } from "./types";

const LOGO_HASH = "41F82E927632C5E2C21DDAC9C08E229CAFF1C84C4D90A73A2B49CAD310AE4FEB";
const FLAME_HASH = "A01AA8A1DECFE56289956FED851F2E876B0B15EF3BEA3BBA66BE2EE139A0AD18";
const RESOURCE_REVISION = "les-da-2026-r1";

export const templates: GraphicTemplate[] = [
  {
    id: "les.attente.v1",
    version: "1.0.0",
    name: "Attente animée",
    family: "attente",
    description: "Écran plein cadre 16:9 avec boucle décorative officielle de 15 secondes.",
    width: 1920,
    height: 1080,
    transparent: false,
    thumbnail: "/thumbnails/attente.png",
    validationStatus: "needs_visual_validation",
    resourceRevision: RESOURCE_REVISION,
    parameters: [
      { key: "message", label: "Message", type: "text", required: true, maxLength: 42 },
      { key: "countdownEnabled", label: "Afficher la zone compteur", type: "boolean" },
    ],
    resources: [
      {
        id: "logo-officiel",
        label: "Bloc marque officiel validé",
        path: "/assets/Bloc_marque_sans-fond_blanc.png",
        status: "available",
        required: true,
        integritySha256: LOGO_HASH,
      },
      {
        id: "flamme-officielle",
        label: "Flamme officielle 01",
        path: "/assets/Flamme-01.png",
        status: "available",
        required: true,
        integritySha256: FLAME_HASH,
      },
      {
        id: "eurostile-black",
        label: "Eurostile Extended Black",
        path: "/assets/EurostileExtendedBlack.ttf",
        status: "available",
        required: true,
      },
      {
        id: "eurostile-regular",
        label: "Eurostile Extended Regular",
        path: "Fichier de police non fourni",
        status: "missing",
        required: false,
      },
    ],
  },
  {
    id: "les.synthe.individuel.v1",
    version: "1.0.0",
    name: "Synthé individuel",
    family: "synthe",
    description: "Lower third transparent pour une personne, sans logo ni fond plein écran.",
    width: 1920,
    height: 1080,
    transparent: true,
    thumbnail: "/thumbnails/synthe.png",
    validationStatus: "needs_visual_validation",
    resourceRevision: RESOURCE_REVISION,
    parameters: [
      { key: "name", label: "Nom ou pseudonyme", type: "text", required: true, maxLength: 36 },
      { key: "role", label: "Fonction", type: "text", maxLength: 48 },
      { key: "organization", label: "Organisation", type: "text", maxLength: 48 },
    ],
    resources: [
      {
        id: "eurostile-black",
        label: "Eurostile Extended Black",
        path: "/assets/EurostileExtendedBlack.ttf",
        status: "available",
        required: true,
      },
      {
        id: "gotham-black",
        label: "Gotham Black",
        path: "/assets/GothamBlack.otf",
        status: "available",
        required: true,
      },
    ],
  },
];

export const templateById = new Map(templates.map((template) => [template.id, template]));

export const seedPresets: Preset[] = [
  {
    id: "preset-attente-live-bientot",
    templateId: "les.attente.v1",
    templateVersion: "1.0.0",
    name: "LE LIVE COMMENCE BIENTÔT",
    family: "attente",
    content: { message: "LE LIVE COMMENCE BIENTÔT", countdownEnabled: true },
    validationStatus: "needs_visual_validation",
    resourceRevision: RESOURCE_REVISION,
    locked: true,
    createdAtUtc: "2026-09-30T00:00:00.000Z",
    updatedAtUtc: "2026-09-30T00:00:00.000Z",
  },
  {
    id: "preset-attente-retour",
    templateId: "les.attente.v1",
    templateVersion: "1.0.0",
    name: "ON REVIENT DANS UN INSTANT",
    family: "attente",
    content: { message: "ON REVIENT DANS UN INSTANT", countdownEnabled: true },
    validationStatus: "needs_visual_validation",
    resourceRevision: RESOURCE_REVISION,
    locked: true,
    createdAtUtc: "2026-09-30T00:00:00.000Z",
    updatedAtUtc: "2026-09-30T00:00:00.000Z",
  },
  {
    id: "preset-synthe-vierge",
    templateId: "les.synthe.individuel.v1",
    templateVersion: "1.0.0",
    name: "Synthé individuel — vierge",
    family: "synthe",
    content: { name: "", role: "", organization: "" },
    validationStatus: "needs_visual_validation",
    resourceRevision: RESOURCE_REVISION,
    locked: true,
    createdAtUtc: "2026-09-30T00:00:00.000Z",
    updatedAtUtc: "2026-09-30T00:00:00.000Z",
  },
];

export function getTemplateForOutput(output: "attente" | "synthe") {
  return templates.find((template) => template.family === output)!;
}
