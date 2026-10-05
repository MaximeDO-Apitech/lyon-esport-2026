export const REPLAY_PACK_VERSION = "1.0.0" as const;

export const REPLAY_TRANSITIONS = {
  in: {
    id: "replay-in-les",
    durationMs: 800,
    cutPointMs: 400,
    opaqueWindowMs: [200, 600] as const,
    transparentEndMs: 760,
    title: true,
  },
  out: {
    id: "replay-out-les",
    durationMs: 600,
    cutPointMs: 300,
    opaqueWindowMs: [160, 400] as const,
    transparentEndMs: 560,
    title: false,
  },
} as const;

export type ReplayTransitionKind = keyof typeof REPLAY_TRANSITIONS;
export type ReplayPlaybackStatus = "loading" | "ready" | "playing" | "error";

export const REPLAY_MARKER = {
  id: "replay-marker-les",
  width: 260,
  height: 68,
  enterMs: 150,
  exitMs: 130,
  defaultPlacement: {
    corner: "top-left" as const,
    offsetX: 96,
    offsetY: 72,
  },
} as const;

export const REPLAY_ASSETS = [
  {
    id: "texture-officielle",
    label: "Texture Elements-01",
    path: "/assets/Elements-01.png",
    integritySha256: "58DDDC2B1106E24ABEA6433F736A6B96627BEA7278E3790972AD6EF9CE5694F6",
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
] as const;

export const REPLAY_LIBRARY_ASSET = {
  id: "replay-pack-les",
  version: REPLAY_PACK_VERSION,
  name: "Pack replay LES",
  family: "Replay",
  description: "Entrée et sortie alpha indépendantes, plus marqueur persistant pilotable sans durée imposée.",
  width: 1920,
  height: 1080,
  fps: 60,
  cadenceNote: "60 i/s — cadence de diffusion à confirmer",
  transparent: true,
  audio: false,
  validationStatus: "needs_visual_validation" as const,
  previewPath: "/preview/replay",
  exportCommand: "npm run export:replay",
  components: [
    {
      id: REPLAY_TRANSITIONS.in.id,
      label: "Entrée replay",
      durationMs: REPLAY_TRANSITIONS.in.durationMs,
      cutPointMs: REPLAY_TRANSITIONS.in.cutPointMs,
      outputPath: "/output/replay-in",
      thumbnail: "/thumbnails/replay-in-les.png",
    },
    {
      id: REPLAY_MARKER.id,
      label: "Marqueur REPLAY",
      durationMs: null,
      cutPointMs: null,
      outputPath: "/output/replay-marker",
      thumbnail: "/thumbnails/replay-marker-les.png",
    },
    {
      id: REPLAY_TRANSITIONS.out.id,
      label: "Sortie replay",
      durationMs: REPLAY_TRANSITIONS.out.durationMs,
      cutPointMs: REPLAY_TRANSITIONS.out.cutPointMs,
      outputPath: "/output/replay-out",
      thumbnail: "/thumbnails/replay-out-les.png",
    },
  ],
  resources: REPLAY_ASSETS,
} as const;
