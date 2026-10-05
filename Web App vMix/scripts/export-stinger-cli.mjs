import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const DELIVERY = path.resolve(ROOT, "deliverables/stinger-principal-les/v1");
const SEQUENCE = path.join(DELIVERY, "png-sequence");
const PROFILES = path.join(tmpdir(), `les-stinger-cli-${process.pid}`);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const DURATION_MS = 1200;
const FRAME_COUNT = Math.round(DURATION_MS * FPS / 1000);
const FRAME_MS = 1000 / FPS;
const CUT_MS = 600;
const OPAQUE_WINDOW = [320, 800];
const CONCURRENCY = 2;

const RESOURCE_PATHS = [
  "public/assets/Bloc_marque_sans-fond_blanc.png",
  "public/assets/Flamme-03.png",
  "public/assets/Angle.png",
  "public/assets/Nuage-points.png",
  "public/assets/Elements-01.png",
];

function fileName(index) {
  return `stinger-principal-les-${String(index + 1).padStart(4, "0")}.png`;
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function insideDelivery(candidate) {
  const relative = path.relative(DELIVERY, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function serverReady() {
  try {
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`Serveur local indisponible sur ${BASE_URL}. Lance « npm run dev ». (${error})`);
  }
}

function runChrome(index) {
  const timeMs = index * FRAME_MS;
  const output = path.join(SEQUENCE, fileName(index));
  const profile = path.join(PROFILES, String(index));
  const url = `${BASE_URL.replace(/\/$/, "")}/output/stinger?time=${encodeURIComponent(timeMs)}`;
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
    "--virtual-time-budget=2500",
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
      if (code !== 0) return reject(new Error(`Chrome a échoué pour ${fileName(index)} (code ${code}). ${stderr}`));
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          const details = await stat(output);
          if (details.size > 0) return resolve({ index, timeMs, output });
        } catch {}
        await new Promise((done) => setTimeout(done, 100));
      }
      reject(new Error(`Capture absente après Chrome : ${fileName(index)}. ${stderr}`));
    });
  });
}

async function alphaStats(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  let maxAlpha = 0;
  let transparentPixels = 0;
  let opaquePixels = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    const alpha = data[offset];
    minAlpha = Math.min(minAlpha, alpha);
    maxAlpha = Math.max(maxAlpha, alpha);
    if (alpha === 0) transparentPixels += 1;
    if (alpha === 255) opaquePixels += 1;
  }
  return { width: info.width, height: info.height, minAlpha, maxAlpha, transparentPixels, opaquePixels };
}

function opaqueRun(frames) {
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

function sourceSvg(source) {
  const isA = source === "A";
  return Buffer.from(`<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
    <rect width="960" height="540" fill="${isA ? "#021321" : "#291105"}"/>
    <polygon points="0,410 620,0 960,0 340,540 0,540" fill="${isA ? "#06354A" : "#FCC766"}" opacity="0.32"/>
    <polygon points="0,92 680,92 610,165 0,165" fill="${isA ? "#01F7FD" : "#EF7B28"}" opacity="0.25"/>
    <text x="480" y="278" text-anchor="middle" fill="#FAFBFB" font-family="Arial" font-size="102" font-weight="900">${source}</text>
    <text x="480" y="326" text-anchor="middle" fill="#FAFBFB" opacity="0.7" font-family="Arial" font-size="22" letter-spacing="7">SOURCE DE TEST</text>
  </svg>`);
}

async function makeDemo(frames) {
  const buffers = [];
  for (const frame of frames.filter((item) => item.index % 2 === 0)) {
    const source = frame.timeMs < CUT_MS ? "A" : "B";
    const overlay = await sharp(frame.output).resize(960, 540).png().toBuffer();
    buffers.push(await sharp(sourceSvg(source)).composite([{ input: overlay }]).png().toBuffer());
  }
  const destination = path.join(DELIVERY, "demo-a-stinger-b.gif");
  await sharp(buffers, { join: { across: 1, animated: true } })
    .gif({ loop: 0, delay: buffers.map(() => 33), colours: 256 })
    .toFile(destination);
  return { path: "deliverables/stinger-principal-les/v1/demo-a-stinger-b.gif", width: 960, height: 540, fps: 30, note: "Démonstration opaque A → stinger → B, distincte de la séquence alpha." };
}

async function main() {
  await serverReady();
  if (!insideDelivery(SEQUENCE)) throw new Error("Destination de séquence hors dossier de livraison.");
  await rm(SEQUENCE, { recursive: true, force: true });
  await rm(PROFILES, { recursive: true, force: true });
  await mkdir(SEQUENCE, { recursive: true });
  await mkdir(PROFILES, { recursive: true });

  const captures = [];
  for (let start = 0; start < FRAME_COUNT; start += CONCURRENCY) {
    const indexes = Array.from({ length: Math.min(CONCURRENCY, FRAME_COUNT - start) }, (_, offset) => start + offset);
    captures.push(...await Promise.all(indexes.map(runChrome)));
    console.log(`Captures ${Math.min(start + CONCURRENCY, FRAME_COUNT)}/${FRAME_COUNT}`);
  }
  captures.sort((a, b) => a.index - b.index);

  const frames = [];
  for (const capture of captures) {
    const buffer = await readFile(capture.output);
    frames.push({ ...capture, filename: fileName(capture.index), sha256: hash(buffer), alpha: await alphaStats(buffer) });
  }

  const first = frames[0];
  const last = frames.at(-1);
  const cut = frames.find((frame) => frame.index === Math.round(CUT_MS / FRAME_MS));
  const windowFrames = frames.filter((frame) => frame.timeMs >= OPAQUE_WINDOW[0] && frame.timeMs <= OPAQUE_WINDOW[1]);
  const measured = opaqueRun(frames);
  const unique = new Set(frames.map((frame) => frame.sha256)).size;
  const checks = {
    frameCount: frames.length === FRAME_COUNT,
    numberingWithoutGaps: frames.every((frame, index) => frame.filename === fileName(index)),
    dimensions1920x1080: frames.every((frame) => frame.alpha.width === WIDTH && frame.alpha.height === HEIGHT),
    firstFrameAlphaZero: first.alpha.maxAlpha === 0,
    lastFrameAlphaZero: last.alpha.maxAlpha === 0,
    opaqueWindowEveryPixel255: windowFrames.every((frame) => frame.alpha.minAlpha === 255),
    cutFrameEveryPixel255: cut.alpha.minAlpha === 255,
    intermediateMotionVisible: unique >= 12,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`Contrôles export échoués : ${failed.join(", ")}`);

  await copyFile(cut.output, path.join(ROOT, "public/thumbnails/stinger-principal-les.png"));
  const demo = await makeDemo(frames);
  const resources = [];
  for (const resource of RESOURCE_PATHS) {
    const bytes = await readFile(path.join(ROOT, resource));
    resources.push({ path: `/${resource.replace(/^public\//, "")}`, sha256: hash(bytes), bytes: bytes.length });
  }

  const manifest = {
    id: "stinger-principal-les",
    version: "1.1.0",
    generatedAtUtc: new Date().toISOString(),
    resolution: { width: WIDTH, height: HEIGHT },
    frameRate: { numerator: FPS, denominator: 1, fps: FPS, note: "Cadence de diffusion à confirmer." },
    frameCount: FRAME_COUNT,
    frameDurationMs: FRAME_MS,
    effectiveDurationMs: FRAME_COUNT * FRAME_MS,
    lastSampleTimeMs: last.timeMs,
    sampling: "frameIndex * 1000 / fps",
    indexing: { filenameStart: 1, firstFrameTimelineIndex: 0, firstFrameTimeMs: 0, pattern: "stinger-principal-les-####.png" },
    alpha: "straight RGBA PNG",
    audio: false,
    cutPoint: { requestedMs: CUT_MS, effectiveFrameIndexZeroBased: cut.index, filename: cut.filename, effectiveSampleTimeMs: cut.timeMs },
    declaredOpaqueWindowMs: { start: OPAQUE_WINDOW[0], end: OPAQUE_WINDOW[1] },
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
    resources,
    demo,
  };
  const verification = {
    generatedAtUtc: manifest.generatedAtUtc,
    checks,
    uniqueFrameHashes: unique,
    firstFrame: { filename: first.filename, timeMs: first.timeMs, sha256: first.sha256, alpha: first.alpha },
    cutFrame: { filename: cut.filename, timeMs: cut.timeMs, sha256: cut.sha256, alpha: cut.alpha },
    lastFrame: { filename: last.filename, timeMs: last.timeMs, sha256: last.sha256, alpha: last.alpha },
    opaqueFrameChecks: windowFrames.map((frame) => ({ filename: frame.filename, timeMs: frame.timeMs, minAlpha: frame.alpha.minAlpha })),
  };
  await writeFile(path.join(DELIVERY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(DELIVERY, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`);
  await rm(PROFILES, { recursive: true, force: true }).catch(() => {});
  console.log(`Séquence PNG RGBA : ${path.relative(ROOT, SEQUENCE)}`);
  console.log(`Fenêtre opaque mesurée : ${measured[0].timeMs.toFixed(3)}–${measured.at(-1).timeMs.toFixed(3)} ms`);
  console.log(`Démonstration : ${demo.path}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
