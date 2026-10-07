export const STINGER_ID = "stinger-principal-les" as const;
export const STINGER_VERSION = "2.0.0" as const;
export const STINGER_FPS = 60 as const;
export const STINGER_CUT_FRAME = 78 as const;
export const STINGER_CUT_POINT_MS = 1300 as const;

export type StingerVariantKey = "short" | "long";

export type StingerVariant = {
  key: StingerVariantKey;
  slug: string;
  label: string;
  description: string;
  width: 1920;
  height: 1080;
  durationMs: number;
  frameCount: number;
  fps: typeof STINGER_FPS;
  cutPointMs: typeof STINGER_CUT_POINT_MS;
  cutFrameIndex: typeof STINGER_CUT_FRAME;
  opaqueWindowFrames: readonly [number, number];
  opaqueWindowMs: readonly [number, number];
  retractStartMs: number;
  finalFrameTimeMs: number;
  cartoucheWindowMs: readonly [number, number] | null;
  mediaPath: string;
  thumbnail: string;
  sourceFileName: string;
  sourceSha256: string;
  broadcastSequence: string;
  alpha: "source-preserved";
  audio: false;
  validationStatus: "needs_visual_validation";
};

export const STINGER_VARIANTS = {
  short: {
    key: "short",
    slug: "court-2s",
    label: "Court — 2 s",
    description: "Version courte exacte du master fourni, ouverture centrale puis dégagement à 1,667 s.",
    width: 1920,
    height: 1080,
    durationMs: 2000,
    frameCount: 120,
    fps: STINGER_FPS,
    cutPointMs: STINGER_CUT_POINT_MS,
    cutFrameIndex: STINGER_CUT_FRAME,
    opaqueWindowFrames: [64, 99],
    opaqueWindowMs: [64 * 1000 / STINGER_FPS, 100 * 1000 / STINGER_FPS],
    retractStartMs: 100 * 1000 / STINGER_FPS,
    finalFrameTimeMs: 119.5 * 1000 / STINGER_FPS,
    cartoucheWindowMs: null,
    mediaPath: "/assets/stinger/stinger-les-court-2s.webm",
    thumbnail: "/thumbnails/stinger-les-court-2s.png",
    sourceFileName: "Stinger-V2-court-compressed.mov",
    sourceSha256: "148513D14E94751BEC2077281CA584A9B3824A17A812D6A3658F90264998CC54",
    broadcastSequence: "deliverables/stinger-principal-les/v2/court-2s/png-sequence",
    alpha: "source-preserved",
    audio: false,
    validationStatus: "needs_visual_validation",
  },
  long: {
    key: "long",
    slug: "long-5s",
    label: "Long — 5 s",
    description: "Version longue exacte du master fourni, avec son cartouche partenaires CGI entre environ 2,15 et 4,30 s.",
    width: 1920,
    height: 1080,
    durationMs: 5000,
    frameCount: 300,
    fps: STINGER_FPS,
    cutPointMs: STINGER_CUT_POINT_MS,
    cutFrameIndex: STINGER_CUT_FRAME,
    opaqueWindowFrames: [64, 281],
    opaqueWindowMs: [64 * 1000 / STINGER_FPS, 282 * 1000 / STINGER_FPS],
    retractStartMs: 282 * 1000 / STINGER_FPS,
    finalFrameTimeMs: 299.5 * 1000 / STINGER_FPS,
    cartoucheWindowMs: [2150, 4300],
    mediaPath: "/assets/stinger/stinger-les-long-5s.webm",
    thumbnail: "/thumbnails/stinger-les-long-5s.png",
    sourceFileName: "Stinger-V2-Long-compressed.mov",
    sourceSha256: "F5EA1ACF0140C4FF9DDAB069997A4390C4E2781785F2A8583D49E367F3185732",
    broadcastSequence: "deliverables/stinger-principal-les/v2/long-5s/png-sequence",
    alpha: "source-preserved",
    audio: false,
    validationStatus: "needs_visual_validation",
  },
} as const satisfies Record<StingerVariantKey, StingerVariant>;

export const STINGER_VARIANT_LIST = Object.values(STINGER_VARIANTS);
export const DEFAULT_STINGER_VARIANT: StingerVariantKey = "short";

export function isStingerVariantKey(value: string | null | undefined): value is StingerVariantKey {
  return value === "short" || value === "long";
}

export function getStingerVariant(value: string | null | undefined) {
  return STINGER_VARIANTS[isStingerVariantKey(value) ? value : DEFAULT_STINGER_VARIANT];
}

export const STINGER_LIBRARY_ASSET = {
  id: STINGER_ID,
  version: STINGER_VERSION,
  name: "Stinger principal LES",
  family: "Transitions",
  description: "Deux variantes média officielles, court 2 s et long 5 s. Aucun élément n’est recréé en HTML, SVG ou GSAP.",
  width: 1920,
  height: 1080,
  fps: STINGER_FPS,
  transparent: true,
  audio: false,
  cutPointMs: STINGER_CUT_POINT_MS,
  validationStatus: "needs_visual_validation" as const,
  previewPath: "/preview/stinger",
  outputPath: "/output/stinger",
  exportCommand: "npm run export:stinger",
  cadenceNote: "60 i/s confirmés par les deux masters",
  variants: STINGER_VARIANT_LIST,
} as const;

export type StingerPlaybackStatus = "loading" | "ready" | "playing" | "error";
