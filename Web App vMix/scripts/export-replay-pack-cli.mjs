import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const DELIVERY = path.resolve(ROOT, "deliverables/replay-pack-les/v1");
const PROFILE_ROOT = path.join(tmpdir(), `les-replay-export-${process.pid}`);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const FRAME_MS = 1000 / FPS;
const CONCURRENCY = 2;

const TRANSITIONS = [
  {
    key: "in",
    id: "replay-in-les",
    durationMs: 800,
    frameCount: 48,
    cutMs: 400,
    opaqueWindow: [200, 600],
    transparentEndMs: 760,
    route: "/output/replay-in",
  },
  {
    key: "out",
    id: "replay-out-les",
    durationMs: 600,
    frameCount: 36,
    cutMs: 300,
    opaqueWindow: [160, 400],
    transparentEndMs: 560,
    route: "/output/replay-out",
  },
];

const RESOURCE_PATHS = [
  "public/assets/Flamme-03.png",
  "public/assets/Angle.png",
  "public/assets/Nuage-points.png",
  "public/assets/Elements-01.png",
];

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function sequenceDir(spec) {
  return path.join(DELIVERY, spec.id, "png-sequence");
}

function frameName(spec, index) {
  return `${spec.id}-${String(index + 1).padStart(4, "0")}.png`;
}

function relativeToRoot(value) {
  return path.relative(ROOT, value).replaceAll("\\", "/");
}

function assertInsideDelivery(candidate) {
  const relative = path.relative(DELIVERY, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Destination hors dossier replay : ${candidate}`);
  }
}

async function serverReady() {
  try {
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`Serveur local indisponible sur ${BASE_URL}. Lance « npm run dev ». (${error})`);
  }
}

function chromeCapture({ url, output, profile }) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--run-all-compositor-stages-before-draw",
    "--default-background-color=00000000",
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=2200",
    `--user-data-dir=${profile}`,
    `--screenshot=${output}`,
    url,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", async (code) => {
      if (code !== 0) return reject(new Error(`Chrome a échoué (code ${code}). ${stderr}`));
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          const details = await stat(output);
          if (details.size > 0) return resolve();
        } catch {}
        await new Promise((done) => setTimeout(done, 100));
      }
      reject(new Error(`Capture absente : ${output}. ${stderr}`));
    });
  });
}

async function captureTransition(spec, index) {
  const timeMs = index * FRAME_MS;
  const output = path.join(sequenceDir(spec), frameName(spec, index));
  const profile = path.join(PROFILE_ROOT, spec.key, String(index));
  const url = `${BASE_URL.replace(/\/$/, "")}${spec.route}?time=${encodeURIComponent(timeMs)}`;
  await chromeCapture({ url, output, profile });
  return { index, timeMs, output, filename: frameName(spec, index) };
}

async function alphaStats(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  let maxAlpha = 0;
  let transparentPixels = 0;
  let opaquePixels = 0;
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let pixel = 0, offset = 3; offset < data.length; pixel += 1, offset += info.channels) {
    const alpha = data[offset];
    minAlpha = Math.min(minAlpha, alpha);
    maxAlpha = Math.max(maxAlpha, alpha);
    if (alpha === 0) transparentPixels += 1;
    if (alpha === 255) opaquePixels += 1;
    if (alpha > 0) {
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    width: info.width,
    height: info.height,
    minAlpha,
    maxAlpha,
    transparentPixels,
    opaquePixels,
    nonTransparentBounds: right >= 0 ? { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 } : null,
  };
}

function longestOpaqueRun(frames) {
  let best = [];
  let current = [];
  for (const frame of frames) {
    if (frame.alpha.minAlpha === 255) current.push(frame);
    else {
      if (current.length > best.length) best = current;
      current = [];
    }
  }
  return current.length > best.length ? current : best;
}

async function renderTransition(spec) {
  const dir = sequenceDir(spec);
  assertInsideDelivery(dir);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const captures = [];
  for (let start = 0; start < spec.frameCount; start += CONCURRENCY) {
    const indexes = Array.from(
      { length: Math.min(CONCURRENCY, spec.frameCount - start) },
      (_, offset) => start + offset,
    );
    captures.push(...await Promise.all(indexes.map((index) => captureTransition(spec, index))));
    console.log(`${spec.id} : ${Math.min(start + CONCURRENCY, spec.frameCount)}/${spec.frameCount}`);
  }
  captures.sort((a, b) => a.index - b.index);

  const frames = [];
  for (const capture of captures) {
    const bytes = await readFile(capture.output);
    frames.push({ ...capture, sha256: hash(bytes), alpha: await alphaStats(bytes) });
  }

  const first = frames[0];
  const last = frames.at(-1);
  const cutIndex = Math.round(spec.cutMs / FRAME_MS);
  const cut = frames[cutIndex];
  const declaredWindowFrames = frames.filter(
    (frame) => frame.timeMs >= spec.opaqueWindow[0] && frame.timeMs <= spec.opaqueWindow[1],
  );
  const measured = longestOpaqueRun(frames);
  const unique = new Set(frames.map((frame) => frame.sha256)).size;
  const checks = {
    frameCount: frames.length === spec.frameCount,
    numberingWithoutGaps: frames.every((frame, index) => frame.filename === frameName(spec, index)),
    dimensions1920x1080: frames.every((frame) => frame.alpha.width === WIDTH && frame.alpha.height === HEIGHT),
    firstFrameAlphaZero: first.alpha.maxAlpha === 0,
    lastFrameAlphaZero: last.alpha.maxAlpha === 0,
    declaredOpaqueWindowEveryPixel255: declaredWindowFrames.every((frame) => frame.alpha.minAlpha === 255),
    cutFrameEveryPixel255: cut.alpha.minAlpha === 255,
    intermediateMotionVisible: unique >= 10,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`${spec.id} : contrôles échoués : ${failed.join(", ")}`);

  const thumbnail = path.join(ROOT, "public", "thumbnails", `${spec.id}.png`);
  await copyFile(cut.output, thumbnail);
  const generatedAtUtc = new Date().toISOString();
  const componentDir = path.join(DELIVERY, spec.id);
  const manifest = {
    id: spec.id,
    packVersion: "1.0.0",
    generatedAtUtc,
    resolution: { width: WIDTH, height: HEIGHT },
    frameRate: { numerator: FPS, denominator: 1, fps: FPS, note: "Cadence de diffusion à confirmer." },
    frameCount: spec.frameCount,
    frameDurationMs: FRAME_MS,
    effectiveDurationMs: spec.frameCount * FRAME_MS,
    lastSampleTimeMs: last.timeMs,
    sampling: "frameIndex * 1000 / fps",
    indexing: {
      filenameStart: 1,
      firstFrameTimelineIndex: 0,
      firstFrameTimeMs: 0,
      pattern: `${spec.id}-####.png`,
    },
    alpha: "straight RGBA PNG",
    audio: false,
    cutPoint: {
      requestedMs: spec.cutMs,
      effectiveFrameIndexZeroBased: cut.index,
      filename: cut.filename,
      effectiveSampleTimeMs: cut.timeMs,
    },
    declaredOpaqueWindowMs: { start: spec.opaqueWindow[0], end: spec.opaqueWindow[1] },
    transparentByMs: spec.transparentEndMs,
    measuredOpaqueWindow: {
      firstFrameIndexZeroBased: measured[0].index,
      firstFilename: measured[0].filename,
      firstSampleTimeMs: measured[0].timeMs,
      lastFrameIndexZeroBased: measured.at(-1).index,
      lastFilename: measured.at(-1).filename,
      lastSampleTimeMs: measured.at(-1).timeMs,
      frameCount: measured.length,
      criterion: "minimum alpha equals 255 on every pixel",
    },
  };
  const verification = {
    generatedAtUtc,
    checks,
    uniqueFrameHashes: unique,
    firstFrame: { filename: first.filename, timeMs: first.timeMs, sha256: first.sha256, alpha: first.alpha },
    cutFrame: { filename: cut.filename, timeMs: cut.timeMs, sha256: cut.sha256, alpha: cut.alpha },
    lastFrame: { filename: last.filename, timeMs: last.timeMs, sha256: last.sha256, alpha: last.alpha },
    opaqueFrameChecks: declaredWindowFrames.map((frame) => ({
      filename: frame.filename,
      timeMs: frame.timeMs,
      minAlpha: frame.alpha.minAlpha,
    })),
  };
  await writeFile(path.join(componentDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(componentDir, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`);
  return { spec, frames, manifest, verification, thumbnail };
}

async function renderMarker() {
  const markerDir = path.join(DELIVERY, "replay-marker-les");
  assertInsideDelivery(markerDir);
  await mkdir(markerDir, { recursive: true });
  const output = path.join(markerDir, "replay-marker-les.png");
  const profile = path.join(PROFILE_ROOT, "marker");
  const url = `${BASE_URL.replace(/\/$/, "")}/output/replay-marker?force=visible&corner=top-left&offsetX=96&offsetY=72`;
  await chromeCapture({ url, output, profile });
  const bytes = await readFile(output);
  const alpha = await alphaStats(bytes);
  const bounds = alpha.nonTransparentBounds;
  const checks = {
    dimensions1920x1080: alpha.width === WIDTH && alpha.height === HEIGHT,
    transparentOutsideMarker: alpha.minAlpha === 0 && alpha.transparentPixels > WIDTH * HEIGHT * 0.94,
    opaqueMarkerPixelsPresent: alpha.maxAlpha === 255 && alpha.opaquePixels > 5000,
    markerLocalizedAtDefaultTopLeft: Boolean(
      bounds &&
      bounds.left >= 94 && bounds.left <= 98 &&
      bounds.top >= 70 && bounds.top <= 74 &&
      bounds.width >= 255 && bounds.width <= 262 &&
      bounds.height >= 64 && bounds.height <= 70
    ),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`replay-marker-les : contrôles échoués : ${failed.join(", ")}`);

  await copyFile(output, path.join(ROOT, "public", "thumbnails", "replay-marker-les.png"));
  const generatedAtUtc = new Date().toISOString();
  const manifest = {
    id: "replay-marker-les",
    packVersion: "1.0.0",
    generatedAtUtc,
    resolution: { width: WIDTH, height: HEIGHT },
    cardSize: { width: 260, height: 68 },
    defaultPlacement: { corner: "top-left", offsetX: 96, offsetY: 72 },
    alternatePlacement: { corner: "top-right", configurableOffsets: true },
    entranceMs: 150,
    exitMs: 130,
    persistent: true,
    alpha: "straight RGBA PNG",
    audio: false,
    fallbackPng: "replay-marker-les.png",
  };
  const verification = {
    generatedAtUtc,
    checks,
    sha256: hash(bytes),
    alpha,
  };
  await writeFile(path.join(markerDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(markerDir, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`);
  return { output, manifest, verification };
}

function sourceSvg(source, timeMs) {
  const palettes = {
    A: ["#071221", "#22345B", "#01F7FD"],
    B: ["#031A25", "#08717C", "#01F7FD"],
    C: ["#241006", "#8A431D", "#EF7B28"],
  };
  const [base, secondary, accent] = palettes[source];
  const shift = Math.round((timeMs / 8000) * 280);
  const label = source === "A" ? "DIRECT" : source === "B" ? "REPLAY · PLAN LARGE" : "REPLAY · ANGLE 2";
  return Buffer.from(`<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs>
    <rect width="960" height="540" fill="url(#g)"/>
    <g transform="translate(${shift - 140} 0)" opacity=".18" stroke="#FAFBFB" fill="none" stroke-width="3">
      <rect x="80" y="-170" width="590" height="590" transform="rotate(45 375 125)"/>
      <rect x="290" y="-20" width="360" height="360" transform="rotate(45 470 160)"/>
    </g>
    <path d="M0 430 L620 0 L960 0 L350 540 L0 540 Z" fill="${accent}" opacity=".12"/>
    <text x="480" y="290" text-anchor="middle" fill="#FAFBFB" font-family="Arial" font-size="108" font-weight="900">${source}</text>
    <text x="48" y="498" fill="#FAFBFB" font-family="Arial" font-size="22" font-weight="700" letter-spacing="5">${label}</text>
  </svg>`);
}

async function makeDemo(inResult, outResult, marker) {
  const markerOverlay = await sharp(marker.output).resize(960, 540).png().toBuffer();
  const buffers = [];
  const totalFrames = 240;
  for (let index = 0; index < totalFrames; index += 1) {
    const timeMs = index * (1000 / 30);
    const source = timeMs < 400 ? "A" : timeMs < 3400 ? "B" : timeMs < 7100 ? "C" : "A";
    const composites = [];
    if (timeMs >= 350 && timeMs < 6950) composites.push({ input: markerOverlay });
    if (timeMs < 800) {
      const frameIndex = Math.min(inResult.frames.length - 1, Math.floor(timeMs / FRAME_MS));
      composites.push({ input: await sharp(inResult.frames[frameIndex].output).resize(960, 540).png().toBuffer() });
    }
    if (timeMs >= 6800 && timeMs < 7400) {
      const frameIndex = Math.min(outResult.frames.length - 1, Math.floor((timeMs - 6800) / FRAME_MS));
      composites.push({ input: await sharp(outResult.frames[frameIndex].output).resize(960, 540).png().toBuffer() });
    }
    buffers.push(await sharp(sourceSvg(source, timeMs)).composite(composites).png().toBuffer());
    if ((index + 1) % 30 === 0) console.log(`Démo replay : ${index + 1}/${totalFrames}`);
  }
  const output = path.join(DELIVERY, "demo-replay-complet.gif");
  await sharp(buffers, { join: { across: 1, animated: true } })
    .gif({ loop: 0, delay: buffers.map(() => 33), colours: 256 })
    .toFile(output);
  return {
    path: relativeToRoot(output),
    width: 960,
    height: 540,
    fps: 30,
    durationMs: 8000,
    alpha: false,
    scenario: "A → replay-in → B → C → replay-out → A",
    note: "Démonstration opaque de contrôle, distincte des livrables alpha.",
  };
}

async function main() {
  await serverReady();
  await mkdir(path.join(ROOT, "public", "thumbnails"), { recursive: true });
  await mkdir(DELIVERY, { recursive: true });
  await rm(PROFILE_ROOT, { recursive: true, force: true });
  await mkdir(PROFILE_ROOT, { recursive: true });

  const inResult = await renderTransition(TRANSITIONS[0]);
  const outResult = await renderTransition(TRANSITIONS[1]);
  const marker = await renderMarker();
  const demo = await makeDemo(inResult, outResult, marker);

  const resources = [];
  for (const resource of RESOURCE_PATHS) {
    const bytes = await readFile(path.join(ROOT, resource));
    resources.push({
      path: `/${resource.replace(/^public\//, "")}`,
      sha256: hash(bytes),
      bytes: bytes.length,
      transformed: false,
    });
  }

  const packManifest = {
    id: "replay-pack-les",
    version: "1.0.0",
    generatedAtUtc: new Date().toISOString(),
    resolution: { width: WIDTH, height: HEIGHT },
    prototypeFrameRate: { fps: FPS, note: "Cadence de diffusion à confirmer sur le preset vMix réel." },
    audio: false,
    automation: "Aucun minuteur de replay imposé.",
    components: [
      {
        id: inResult.spec.id,
        type: "rgba-png-sequence",
        manifest: `${inResult.spec.id}/manifest.json`,
        verification: `${inResult.spec.id}/verification.json`,
      },
      {
        id: "replay-marker-les",
        type: "persistent-browser-output-with-png-fallback",
        manifest: "replay-marker-les/manifest.json",
        verification: "replay-marker-les/verification.json",
      },
      {
        id: outResult.spec.id,
        type: "rgba-png-sequence",
        manifest: `${outResult.spec.id}/manifest.json`,
        verification: `${outResult.spec.id}/verification.json`,
      },
    ],
    resources,
    demo,
  };
  await writeFile(path.join(DELIVERY, "manifest.json"), `${JSON.stringify(packManifest, null, 2)}\n`);
  await rm(PROFILE_ROOT, { recursive: true, force: true }).catch(() => {});

  console.log(`Pack replay généré : ${relativeToRoot(DELIVERY)}`);
  console.log(`Entrée : ${inResult.frames.length} PNG RGBA`);
  console.log(`Sortie : ${outResult.frames.length} PNG RGBA`);
  console.log(`Marqueur : ${relativeToRoot(marker.output)}`);
  console.log(`Démo : ${demo.path}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
