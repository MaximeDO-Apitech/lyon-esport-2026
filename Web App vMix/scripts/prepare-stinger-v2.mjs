import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const DELIVERY = path.resolve(ROOT, "deliverables/stinger-principal-les/v2");
const PUBLIC_MEDIA = path.resolve(ROOT, "public/assets/stinger");
const PUBLIC_THUMBNAILS = path.resolve(ROOT, "public/thumbnails");
const AUDIT_CAPTURE = path.resolve(ROOT, "captures/stinger-v2-audit");
const VERSION = "2.0.0";
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const CUT_FRAME = 78;
const CUT_MS = CUT_FRAME * 1000 / FPS;

const cli = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith("--")) continue;
  cli.set(process.argv[index].slice(2), process.argv[index + 1]);
  index += 1;
}

const variants = [
  {
    key: "short",
    slug: "court-2s",
    label: "Court — 2 s",
    source: path.resolve(cli.get("short") ?? "C:/Users/maximed/Downloads/Stinger-V2-court-compressed.mov"),
    expectedSourceHash: "148513D14E94751BEC2077281CA584A9B3824A17A812D6A3658F90264998CC54",
    durationMs: 2000,
    frameCount: 120,
    opaqueStartFrame: 64,
    opaqueEndFrame: 99,
    finalTransparentFrame: 119,
    thumbnailFrame: 78,
    auditFrames: [0, 10, 19, 32, 63, 64, 78, 99, 100, 110, 118, 119],
  },
  {
    key: "long",
    slug: "long-5s",
    label: "Long — 5 s",
    source: path.resolve(cli.get("long") ?? "C:/Users/maximed/Downloads/Stinger-V2-Long-compressed.mov"),
    expectedSourceHash: "F5EA1ACF0140C4FF9DDAB069997A4390C4E2781785F2A8583D49E367F3185732",
    durationMs: 5000,
    frameCount: 300,
    opaqueStartFrame: 64,
    opaqueEndFrame: 281,
    finalTransparentFrame: 299,
    thumbnailFrame: 180,
    auditFrames: [0, 10, 19, 32, 64, 78, 129, 180, 258, 281, 282, 299],
  },
];

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findBelow(root, fileName, maxDepth = 4) {
  if (!root || !await exists(root)) return null;
  const queue = [{ directory: root, depth: 0 }];
  while (queue.length) {
    const { directory, depth } = queue.shift();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    const match = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase());
    if (match) return path.join(directory, match.name);
    if (depth >= maxDepth) continue;
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push({ directory: path.join(directory, entry.name), depth: depth + 1 });
    }
  }
  return null;
}

async function resolveTool(name) {
  const envName = `${name.toUpperCase()}_PATH`;
  if (process.env[envName] && await exists(process.env[envName])) return process.env[envName];
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  const probe = spawnSync(executable, ["-version"], { stdio: "ignore", windowsHide: true });
  if (!probe.error && probe.status === 0) return executable;

  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages"),
        "C:/Program Files/Streamlink/ffmpeg",
        path.join(process.env.LOCALAPPDATA ?? "", "Programs"),
      ]
    : ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"];
  for (const root of candidates) {
    const found = await findBelow(root, executable, 5);
    if (found) return found;
  }
  throw new Error(`${name} introuvable. Définissez ${envName} avec le chemin complet du binaire.`);
}

function run(executable, args, { capture = false, cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    const stdout = [];
    const stderr = [];
    if (capture) {
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(capture ? {
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        } : undefined);
      } else {
        reject(new Error(`${path.basename(executable)} a quitté avec le code ${code}.\n${Buffer.concat(stderr).toString("utf8")}`));
      }
    });
  });
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").toUpperCase();
}

async function probe(ffprobe, file) {
  const result = await run(ffprobe, [
    "-v", "error",
    "-show_entries", "format=filename,duration,size,bit_rate:stream=index,codec_name,codec_type,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,duration,bit_rate:stream_tags=timecode,handler_name,alpha_mode",
    "-of", "json",
    file,
  ], { capture: true });
  return JSON.parse(result.stdout);
}

function videoStream(metadata) {
  return metadata.streams.find((stream) => stream.codec_type === "video");
}

function assertSource(variant, metadata, sourceHash) {
  const video = videoStream(metadata);
  const audio = metadata.streams.filter((stream) => stream.codec_type === "audio");
  const failures = [];
  if (sourceHash !== variant.expectedSourceHash) failures.push("empreinte SHA-256 inattendue");
  if (video?.codec_name !== "prores" || video?.profile !== "4444") failures.push("codec différent de ProRes 4444");
  if (video?.pix_fmt !== "yuva444p12le") failures.push(`format alpha inattendu (${video?.pix_fmt})`);
  if (video?.width !== WIDTH || video?.height !== HEIGHT) failures.push("définition différente de 1920×1080");
  if (video?.r_frame_rate !== "60/1" || Number(video?.nb_frames) !== variant.frameCount) failures.push("cadence ou nombre d’images inattendu");
  if (audio.length) failures.push("piste audio détectée");
  if (failures.length) throw new Error(`${variant.label} : ${failures.join(", ")}.`);
}

function alphaFilter(variant) {
  const pass = "lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)'";
  const filters = [
    "format=yuva444p12le",
    `geq=${pass}:a='65535':enable='between(n,${variant.opaqueStartFrame},${variant.opaqueEndFrame})'`,
  ];
  if (variant.key === "long") {
    filters.push(`geq=${pass}:a='0':enable='eq(n,${variant.finalTransparentFrame})'`);
  }
  filters.push("format=yuva444p12le");
  return filters.join(",");
}

function parseSignalStats(output) {
  const frames = [];
  let current = null;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const frameMatch = /^frame:(\d+)\s+.*pts_time:([^\s]+)/.exec(line);
    if (frameMatch) {
      current = { index: Number(frameMatch[1]), timeSeconds: Number(frameMatch[2]) };
      frames.push(current);
      continue;
    }
    if (!current) continue;
    const valueMatch = /^lavfi\.signalstats\.(YMIN|YMAX|YAVG)=([\d.]+)/.exec(line);
    if (valueMatch) current[valueMatch[1].toLowerCase()] = Number(valueMatch[2]);
  }
  return frames;
}

async function alphaSignalStats(ffmpeg, file, transform = null) {
  const result = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", file,
    "-map", "0:v:0",
    "-vf", `${transform ? `${transform},` : ""}alphaextract,signalstats,metadata=print:file=-:direct=1`,
    "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null",
  ], { capture: true });
  return parseSignalStats(result.stdout);
}

async function exactAlphaFrames(ffmpeg, file, indexes, transform = null) {
  const expression = indexes.map((index) => `eq(n\\,${index})`).join("+");
  const child = spawn(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", file,
    "-map", "0:v:0",
    "-vf", `${transform ? `${transform},` : ""}select=${expression},alphaextract,format=gray12le`,
    "-fps_mode", "passthrough",
    "-f", "rawvideo", "-pix_fmt", "gray12le", "pipe:1",
  ], { cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const frameBytes = WIDTH * HEIGHT * 2;
  let chunks = [];
  let chunkBytes = 0;
  let resultIndex = 0;
  const results = [];

  const inspect = (frame, frameIndex) => {
    const values = new Uint16Array(frame.buffer, frame.byteOffset, WIDTH * HEIGHT);
    let min = 4095;
    let max = 0;
    let underMaxPixels = 0;
    let nonZeroPixels = 0;
    let leftColumnUnderMaxPixels = 0;
    for (let offset = 0; offset < values.length; offset += 1) {
      const value = values[offset];
      if (value < min) min = value;
      if (value > max) max = value;
      if (value < 4095) underMaxPixels += 1;
      if (value > 0) nonZeroPixels += 1;
    }
    for (let y = 0; y < HEIGHT; y += 1) {
      if (values[y * WIDTH] < 4095) leftColumnUnderMaxPixels += 1;
    }
    results.push({
      frameIndex,
      timeMs: frameIndex * 1000 / FPS,
      min,
      max,
      underMaxPixels,
      nonZeroPixels,
      leftColumnUnderMaxPixels,
    });
  };

  for await (const chunk of child.stdout) {
    chunks.push(chunk);
    chunkBytes += chunk.length;
    while (chunkBytes >= frameBytes) {
      const joined = Buffer.concat(chunks, chunkBytes);
      const frame = joined.subarray(0, frameBytes);
      inspect(frame, indexes[resultIndex]);
      resultIndex += 1;
      const remainder = joined.subarray(frameBytes);
      chunks = remainder.length ? [Buffer.from(remainder)] : [];
      chunkBytes = remainder.length;
    }
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (exitCode !== 0) throw new Error(`Analyse alpha interrompue (${exitCode}).\n${Buffer.concat(stderr).toString("utf8")}`);
  if (resultIndex !== indexes.length) throw new Error(`Analyse alpha incomplète : ${resultIndex}/${indexes.length} images.`);
  return results;
}

async function recreateInside(directory, root) {
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refus de recréer un dossier hors livraison : ${directory}`);
  }
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

function checkerSvg(width, height, size = 40) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="c" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse">
      <rect width="${size * 2}" height="${size * 2}" fill="#e4e7e9"/>
      <rect width="${size}" height="${size}" fill="#aeb5ba"/>
      <rect x="${size}" y="${size}" width="${size}" height="${size}" fill="#aeb5ba"/>
    </pattern></defs><rect width="100%" height="100%" fill="url(#c)"/>
  </svg>`);
}

async function contactSheets(ffmpeg, variant) {
  const transparentSheet = path.join(AUDIT_CAPTURE, `${variant.slug}-transparent.png`);
  const expression = variant.auditFrames.map((index) => `eq(n\\,${index})`).join("+");
  await run(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", variant.source,
    "-map", "0:v:0",
    "-vf", `${alphaFilter(variant)},select=${expression},scale=480:270:flags=lanczos,tile=4x3,format=rgba`,
    "-frames:v", "1", transparentSheet,
  ]);
  const sheet = await readFile(transparentSheet);
  const outputs = {
    checker: path.join(AUDIT_CAPTURE, `${variant.slug}-checker.png`),
    light: path.join(AUDIT_CAPTURE, `${variant.slug}-light.png`),
    dark: path.join(AUDIT_CAPTURE, `${variant.slug}-dark.png`),
  };
  await Promise.all([
    sharp(checkerSvg(1920, 810)).composite([{ input: sheet }]).png().toFile(outputs.checker),
    sharp({ create: { width: 1920, height: 810, channels: 4, background: "#f4f4f0" } }).composite([{ input: sheet }]).png().toFile(outputs.light),
    sharp({ create: { width: 1920, height: 810, channels: 4, background: "#03070b" } }).composite([{ input: sheet }]).png().toFile(outputs.dark),
  ]);
  return Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, path.relative(ROOT, value).replaceAll("\\", "/")]));
}

async function pngAlphaStats(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  let max = 0;
  let underMaxPixels = 0;
  let nonZeroPixels = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    const alpha = data[offset];
    if (alpha < min) min = alpha;
    if (alpha > max) max = alpha;
    if (alpha < 255) underMaxPixels += 1;
    if (alpha > 0) nonZeroPixels += 1;
  }
  return { min, max, underMaxPixels, nonZeroPixels };
}

async function sequenceDigest(sequenceDirectory, variant) {
  const aggregate = createHash("sha256");
  const lines = [];
  for (let index = 1; index <= variant.frameCount; index += 1) {
    const filename = `stinger-les-${variant.slug}-${String(index).padStart(4, "0")}.png`;
    const digest = await sha256(path.join(sequenceDirectory, filename));
    lines.push(`${digest}  ${filename}`);
    aggregate.update(`${digest}  ${filename}\n`);
  }
  await writeFile(path.join(sequenceDirectory, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
  return aggregate.digest("hex").toUpperCase();
}

async function buildVariant(ffmpeg, ffprobe, variant) {
  const sourceHash = await sha256(variant.source);
  const sourceProbe = await probe(ffprobe, variant.source);
  assertSource(variant, sourceProbe, sourceHash);
  const sourceSize = (await stat(variant.source)).size;
  const variantDirectory = path.join(DELIVERY, variant.slug);
  const sequenceDirectory = path.join(variantDirectory, "png-sequence");
  await recreateInside(sequenceDirectory, DELIVERY);
  const obsoleteIntermediate = path.join(variantDirectory, "broadcast-master");
  const obsoleteRelative = path.relative(DELIVERY, obsoleteIntermediate);
  if (!obsoleteRelative.startsWith("..") && !path.isAbsolute(obsoleteRelative)) {
    await rm(obsoleteIntermediate, { recursive: true, force: true });
  }

  const webm = path.join(PUBLIC_MEDIA, `stinger-les-${variant.slug}.webm`);
  const thumbnail = path.join(PUBLIC_THUMBNAILS, `stinger-les-${variant.slug}.png`);

  console.log(`\n[${variant.label}] séquence PNG RGBA sécurisée, extraite directement du master 12 bits`);
  const pattern = path.join(sequenceDirectory, `stinger-les-${variant.slug}-%04d.png`);
  await run(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "warning",
    "-i", variant.source,
    "-map", "0:v:0", "-frames:v", String(variant.frameCount),
    "-vf", `${alphaFilter(variant)},format=rgba`,
    "-fps_mode", "passthrough", "-start_number", "1",
    "-pix_fmt", "rgba", "-compression_level", "4", pattern,
  ]);

  console.log(`[${variant.label}] WebM VP9 alpha`);
  await run(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "warning",
    "-i", variant.source,
    "-map", "0:v:0", "-an",
    "-vf", alphaFilter(variant),
    "-c:v", "libvpx-vp9", "-lossless", "1", "-cpu-used", "4",
    "-row-mt", "1", "-tile-columns", "2", "-frame-parallel", "0",
    "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-r", String(FPS),
    "-metadata:s:v:0", "alpha_mode=1",
    webm,
  ]);

  await run(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", variant.source,
    "-map", "0:v:0",
    "-vf", `${alphaFilter(variant)},select=eq(n\\,${variant.thumbnailFrame}),format=rgba`,
    "-frames:v", "1", "-fps_mode", "passthrough", thumbnail,
  ]);

  console.log(`[${variant.label}] analyses alpha et planches`);
  const exactIndexes = [...new Set([
    variant.opaqueStartFrame,
    CUT_FRAME,
    variant.opaqueEndFrame,
    variant.finalTransparentFrame,
    ...(variant.key === "long" ? [129, 180, 258] : []),
  ])].sort((a, b) => a - b);
  const securedTransform = alphaFilter(variant);
  const [sourceSignal, securedSignal, sourceExact, securedExact, webProbe, sheets] = await Promise.all([
    alphaSignalStats(ffmpeg, variant.source),
    alphaSignalStats(ffmpeg, variant.source, securedTransform),
    exactAlphaFrames(ffmpeg, variant.source, exactIndexes),
    exactAlphaFrames(ffmpeg, variant.source, exactIndexes, securedTransform),
    probe(ffprobe, webm),
    contactSheets(ffmpeg, variant),
  ]);

  const cutFilename = `stinger-les-${variant.slug}-${String(CUT_FRAME + 1).padStart(4, "0")}.png`;
  const firstFilename = `stinger-les-${variant.slug}-0001.png`;
  const lastFilename = `stinger-les-${variant.slug}-${String(variant.frameCount).padStart(4, "0")}.png`;
  const [firstPngAlpha, cutPngAlpha, lastPngAlpha, webHash, thumbnailHash, sequenceSha256] = await Promise.all([
    pngAlphaStats(path.join(sequenceDirectory, firstFilename)),
    pngAlphaStats(path.join(sequenceDirectory, cutFilename)),
    pngAlphaStats(path.join(sequenceDirectory, lastFilename)),
    sha256(webm),
    sha256(thumbnail),
    sequenceDigest(sequenceDirectory, variant),
  ]);

  const sourceVideo = videoStream(sourceProbe);
  const webVideo = videoStream(webProbe);
  const opaqueSignal = securedSignal.slice(variant.opaqueStartFrame, variant.opaqueEndFrame + 1);
  const securedByIndex = new Map(securedExact.map((frame) => [frame.frameIndex, frame]));
  const checks = {
    sourceSha256Matches: sourceHash === variant.expectedSourceHash,
    sourceIsProRes4444Alpha12Bit: sourceVideo.codec_name === "prores" && sourceVideo.profile === "4444" && sourceVideo.pix_fmt === "yuva444p12le",
    sourceFrameCountMatches: Number(sourceVideo.nb_frames) === variant.frameCount,
    sourceHasNoAudio: sourceProbe.streams.every((stream) => stream.codec_type !== "audio"),
    opaqueWindowAllFramesMaxAlpha: opaqueSignal.length === variant.opaqueEndFrame - variant.opaqueStartFrame + 1 && opaqueSignal.every((frame) => frame.ymin === 3773 && frame.ymax === 3773),
    exactCutFrameAlpha4095: securedByIndex.get(CUT_FRAME)?.min === 4095 && securedByIndex.get(CUT_FRAME)?.max === 4095,
    finalSecuredFrameTransparent: securedByIndex.get(variant.finalTransparentFrame)?.max === 0,
    firstPngFrameTransparent: firstPngAlpha.max === 0,
    cutPngFrameOpaque: cutPngAlpha.min === 255,
    lastPngFrameTransparent: lastPngAlpha.max === 0,
    webDerivativeDeclaresAlpha: webVideo?.tags?.ALPHA_MODE === "1" || webVideo?.tags?.alpha_mode === "1" || webProbe.streams.some((stream) => stream.tags?.ALPHA_MODE === "1" || stream.tags?.alpha_mode === "1"),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`${variant.label} : contrôles échoués — ${failed.join(", ")}`);

  return {
    key: variant.key,
    slug: variant.slug,
    label: variant.label,
    status: "needs_visual_validation",
    source: {
      fileName: path.basename(variant.source),
      sha256: sourceHash,
      bytes: sourceSize,
      protectedReadOnly: true,
      codec: `${sourceVideo.codec_name} ${sourceVideo.profile}`,
      pixelFormat: sourceVideo.pix_fmt,
      timecode: sourceVideo.tags?.timecode ?? null,
      streams: sourceProbe.streams.map((stream) => ({ index: stream.index, type: stream.codec_type, handler: stream.tags?.handler_name ?? null })),
    },
    durationMs: variant.durationMs,
    resolution: { width: WIDTH, height: HEIGHT },
    fps: FPS,
    frameCount: variant.frameCount,
    audio: false,
    cut: {
      timeMs: CUT_MS,
      frameIndexZeroBased: CUT_FRAME,
      filename: cutFilename,
    },
    opaqueWindow: {
      firstFrameIndexZeroBased: variant.opaqueStartFrame,
      firstTimeMs: variant.opaqueStartFrame * 1000 / FPS,
      lastFrameIndexZeroBased: variant.opaqueEndFrame,
      lastTimeMs: variant.opaqueEndFrame * 1000 / FPS,
      criterion: "alpha 4095/4095 on every pixel in the secured broadcast derivative",
    },
    browserDerivative: {
      path: `/${path.relative(path.join(ROOT, "public"), webm).replaceAll("\\", "/")}`,
      sha256: webHash,
      codec: webVideo.codec_name,
      pixelFormatReportedByFfprobe: webVideo.pix_fmt,
      alphaMode: 1,
      note: "Proxy de prévisualisation VP9 lossless avec alpha, chroma 4:2:0 pour compatibilité navigateur ; il n’est pas le dérivé de diffusion.",
    },
    pngSequence: {
      directory: path.relative(ROOT, sequenceDirectory).replaceAll("\\", "/"),
      pattern: `stinger-les-${variant.slug}-####.png`,
      frameCount: variant.frameCount,
      pixelFormat: "RGBA 8-bit PNG",
      alphaAssociation: "Valeurs couleur/alpha du master préservées ; aucune conversion globale premultiply/unpremultiply.",
      sourcePipeline: "Extraction directe du master ProRes 4444 12 bits ; aucun réencodage ProRes intermédiaire.",
      aggregateSha256: sequenceSha256,
      hashesFile: "SHA256SUMS.txt",
    },
    thumbnail: {
      path: `/${path.relative(path.join(ROOT, "public"), thumbnail).replaceAll("\\", "/")}`,
      frameIndexZeroBased: variant.thumbnailFrame,
      sha256: thumbnailHash,
    },
    auditSheets: sheets,
    verification: {
      checks,
      sourceSignalFrames: sourceSignal.length,
      securedSignalFrames: securedSignal.length,
      sourceExactAlpha: sourceExact,
      securedExactAlpha: securedExact,
      pngAlpha: { first: firstPngAlpha, cut: cutPngAlpha, last: lastPngAlpha },
    },
  };
}

async function main() {
  const [ffmpeg, ffprobe] = await Promise.all([resolveTool("ffmpeg"), resolveTool("ffprobe")]);
  console.log(`ffmpeg : ${ffmpeg}`);
  console.log(`ffprobe: ${ffprobe}`);
  await Promise.all([
    mkdir(DELIVERY, { recursive: true }),
    mkdir(PUBLIC_MEDIA, { recursive: true }),
    mkdir(PUBLIC_THUMBNAILS, { recursive: true }),
    mkdir(AUDIT_CAPTURE, { recursive: true }),
  ]);

  const generatedAtUtc = new Date().toISOString();
  const results = [];
  for (const variant of variants) results.push(await buildVariant(ffmpeg, ffprobe, variant));
  const manifest = {
    id: "stinger-principal-les",
    version: VERSION,
    generatedAtUtc,
    family: "Transitions",
    validationStatus: "needs_visual_validation",
    publication: "not_published_to_production",
    cutMechanism: "native vMix stinger cut",
    alphaAssociation: "Analyse numérique compatible avec des contours prémultipliés ; aucune conversion globale appliquée. Contrôle visuel fourni sur damier, fond clair et fond sombre.",
    variants: results.map((result) => {
      const variant = { ...result };
      delete variant.verification;
      return variant;
    }),
  };
  const verification = {
    generatedAtUtc,
    sourceProtection: "Original MOV files remain distinct and read-only; derivatives are stored in v2.",
    variants: Object.fromEntries(results.map((variant) => [variant.key, variant.verification])),
  };
  await Promise.all([
    writeFile(path.join(DELIVERY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(path.join(DELIVERY, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`),
  ]);
  console.log(`\nManifest: ${path.relative(ROOT, path.join(DELIVERY, "manifest.json"))}`);
  console.log("Les statuts restent « needs_visual_validation » : aucun test automatique ne vaut validation artistique.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
