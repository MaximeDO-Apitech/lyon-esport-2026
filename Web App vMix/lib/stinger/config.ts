export const STINGER_ID = "stinger-principal-les" as const;
export const STINGER_VERSION = "1.1.0" as const;

export const STINGER_TIMING = {
  durationMs: 1200,
  entryEndMs: 320,
  cutPointMs: 600,
  exitStartMs: 800,
  transparentEndMs: 1160,
  prototypeFps: 60,
} as const;

export const STINGER_ASSETS = [
  {
    id: "logo-officiel",
    label: "Bloc marque officiel validé",
    path: "/assets/Bloc_marque_sans-fond_blanc.png",
    integritySha256: "3F08D41E08330F7B00E44C8CB8A07600D7B701CD053571E101BCCED94731E721",
  },
  {
    id: "volute-officielle",
    label: "Volute officielle Flamme-03",
    path: "/assets/Flamme-03.png",
    integritySha256: "1FAD52C947A09A6D0475D69790C184D62D67EF247CDE6CD5561D35A1DC33B7DE",
  },
  {
    id: "angle-officiel",
    label: "Angle officiel",
    path: "/assets/Angle.png",
    integritySha256: "27867347627471C47455FB4811F939DC722BD30CD689BFE1FC512BF91112B1BC",
  },
  {
    id: "nuage-points-officiel",
    label: "Matrice de points officielle",
    path: "/assets/Nuage-points.png",
    integritySha256: "783557273DF93595CB0AA8E3449DFDAEFD0B17783476E6F0386BCF8085B43632",
  },
  {
    id: "texture-officielle",
    label: "Texture Elements-01",
    path: "/assets/Elements-01.png",
    integritySha256: "58DDDC2B1106E24ABEA6433F736A6B96627BEA7278E3790972AD6EF9CE5694F6",
  },
] as const;

export const STINGER_LIBRARY_ASSET = {
  id: STINGER_ID,
  version: STINGER_VERSION,
  name: "Stinger principal LES",
  family: "Transitions",
  description: "Volet angulaire gauche vers droite, couverture opaque de sécurité et logo officiel centré.",
  width: 1920,
  height: 1080,
  durationMs: STINGER_TIMING.durationMs,
  fps: STINGER_TIMING.prototypeFps,
  transparent: true,
  audio: false,
  cutPointMs: STINGER_TIMING.cutPointMs,
  opaqueWindowMs: [STINGER_TIMING.entryEndMs, STINGER_TIMING.exitStartMs] as const,
  validationStatus: "needs_visual_validation" as const,
  thumbnail: "/thumbnails/stinger-principal-les.png",
  previewPath: "/preview/stinger",
  outputPath: "/output/stinger",
  exportCommand: "npm run export:stinger",
  cadenceNote: "60 i/s — cadence de diffusion à confirmer",
  resources: STINGER_ASSETS,
} as const;

export type StingerPlaybackStatus = "loading" | "ready" | "playing" | "error";
