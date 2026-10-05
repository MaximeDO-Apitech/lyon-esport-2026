import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT = path.join(ROOT, "captures", "waiting-r5");
const BEFORE = path.join(ROOT, "captures", "waiting-r4", "phase-0.png");
const AFTER = path.join(OUTPUT, "after-phase-0.png");
const WIDTH = 1920;
const HEIGHT = 1080;
const PROOF_WIDTH = 960;
const PROOF_HEIGHT = 540;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function waitForFile(filename) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const details = await stat(filename);
      if (details.size > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Capture absente : ${filename}`);
}

function captureFrame(frameRoot, profileRoot, index) {
  const elapsedSeconds = index;
  const phase = (elapsedSeconds % 15) / 15;
  const output = path.join(frameRoot, `motion-${String(index).padStart(2, "0")}.png`);
  const profile = path.join(profileRoot, String(index));
  const url = `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=${phase.toFixed(6)}`;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--run-all-compositor-stages-before-draw",
    `--window-size=${WIDTH},${HEIGHT}`,
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
    child.on("exit", async () => {
      try {
        await waitForFile(output);
        resolve({ output, elapsedSeconds, phase });
      } catch (error) {
        reject(new Error(`${error.message}\n${stderr}`));
      }
    });
  });
}

async function labeledFrame(filename, label) {
  const image = await sharp(filename).resize(PROOF_WIDTH, PROOF_HEIGHT).png().toBuffer();
  const overlay = Buffer.from(`<svg width="${PROOF_WIDTH}" height="${PROOF_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="330" height="54" rx="6" fill="#010A14" fill-opacity="0.84" stroke="#01F7FD" stroke-opacity="0.7"/>
    <text x="42" y="57" fill="#FAFBFB" font-family="Arial, sans-serif" font-size="28" font-weight="700">${label}</text>
  </svg>`);
  return sharp(image).composite([{ input: overlay }]).png().toBuffer();
}

async function buildContactSheet(inputs, output) {
  const frames = await Promise.all(inputs.map(({ file, label }) => labeledFrame(file, label)));
  await sharp({ create: { width: PROOF_WIDTH * frames.length, height: PROOF_HEIGHT, channels: 4, background: "#010A14" } })
    .composite(frames.map((input, index) => ({ input, left: index * PROOF_WIDTH, top: 0 })))
    .png()
    .toFile(output);
}

async function main() {
  const health = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/health`);
  if (!health.ok) throw new Error(`Serveur local indisponible : HTTP ${health.status}`);

  await mkdir(OUTPUT, { recursive: true });
  const workRoot = await mkdtemp(path.join(tmpdir(), "les-waiting-r5-proof-"));
  const frameRoot = path.join(workRoot, "frames");
  const profileRoot = path.join(workRoot, "profiles");
  await mkdir(frameRoot, { recursive: true });
  await mkdir(profileRoot, { recursive: true });

  const captures = [];
  try {
    for (let start = 0; start < 20; start += 4) {
      const batch = [];
      for (let index = start; index < Math.min(start + 4, 20); index += 1) {
        batch.push(captureFrame(frameRoot, profileRoot, index));
      }
      captures.push(...await Promise.all(batch));
    }
    captures.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

    const rawFrames = await Promise.all(captures.map(({ output }) =>
      sharp(output).resize(PROOF_WIDTH, PROOF_HEIGHT).ensureAlpha().raw().toBuffer()
    ));
    const animatedRaw = Buffer.concat(rawFrames);
    await sharp(animatedRaw, {
      raw: {
        width: PROOF_WIDTH,
        height: PROOF_HEIGHT * rawFrames.length,
        channels: 4,
        pageHeight: PROOF_HEIGHT,
      },
    })
      .gif({ delay: Array(rawFrames.length).fill(1000), loop: 0, effort: 4, dither: 0.8 })
      .toFile(path.join(OUTPUT, "motion-proof-20s.gif"));
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }

  await buildContactSheet([
    { file: BEFORE, label: "AVANT · phase 0" },
    { file: AFTER, label: "APRÈS · phase 0" },
  ], path.join(OUTPUT, "before-after-phase-0.png"));

  await buildContactSheet([
    { file: path.join(OUTPUT, "after-phase-0.png"), label: "t = 0 s" },
    { file: path.join(OUTPUT, "after-phase-25.png"), label: "t = 3,75 s" },
    { file: path.join(OUTPUT, "after-phase-50.png"), label: "t = 7,50 s" },
    { file: path.join(OUTPUT, "after-phase-75.png"), label: "t = 11,25 s" },
  ], path.join(OUTPUT, "motion-phases.png"));

  await copyFile(AFTER, path.join(ROOT, "public", "thumbnails", "attente.png"));

  const proofFiles = [
    "after-phase-0.png",
    "after-phase-25.png",
    "after-phase-50.png",
    "after-phase-75.png",
    "after-phase-99.png",
    "before-after-phase-0.png",
    "motion-phases.png",
    "motion-proof-20s.gif",
  ];
  const artifacts = [];
  for (const filename of proofFiles) {
    const buffer = await readFile(path.join(OUTPUT, filename));
    const metadata = await sharp(buffer, { animated: true }).metadata();
    artifacts.push({
      filename,
      width: metadata.width,
      height: metadata.pageHeight ?? metadata.height,
      pages: metadata.pages ?? 1,
      sha256: sha256(buffer),
    });
  }

  const seamStart = artifacts.find((entry) => entry.filename === "after-phase-0.png");
  const seamEnd = artifacts.find((entry) => entry.filename === "after-phase-99.png");
  await writeFile(path.join(OUTPUT, "proof-manifest.json"), `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    previewUrl: `${BASE_URL.replace(/\/$/, "")}/preview/attente`,
    loopSeconds: 15,
    motionProofSeconds: 20,
    seamHashesMatch: seamStart?.sha256 === seamEnd?.sha256,
    artifacts,
  }, null, 2)}\n`);
}

await main();

