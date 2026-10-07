import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import WebSocket from "ws";

const ROOT = process.cwd();
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9340;
const OUTPUT = path.join(ROOT, "captures", "waiting-r9");
const BEFORE = path.join(ROOT, "captures", "waiting-r8", "after-phase-0.png");
const AFTER = path.join(OUTPUT, "after-phase-0.png");
const WIDTH = 1920;
const HEIGHT = 1080;
const PROOF_WIDTH = 960;
const PROOF_HEIGHT = 540;
const PROOF_MESSAGE = "JE REVIENS DANS UN INSTANT";
const PROOF_COUNTDOWN = "00:00";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function waitForFile(filename) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const details = await stat(filename);
      if (details.size > 0) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Capture absente : ${filename}`);
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/preview/attente"));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome n'a pas exposé la page de capture.");
}

function createCdpClient(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const ready = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function waitForReady(cdp) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const logo = document.querySelector('.waiting-logo img');
        const corners = [...document.querySelectorAll('.waiting-frame-corner img')];
        const rails = [...document.querySelectorAll('.waiting-dot-rail img')];
        return Boolean(
          document.querySelector('[data-message-breath]')?.textContent?.trim() &&
          logo?.complete && corners.length === 8 && corners.every((image) => image.complete) &&
          rails.length === 2 && rails.every((image) => image.complete) &&
          document.fonts.status === 'loaded'
        );
      })()`,
      returnByValue: true,
    });
    if (evaluation.result.value) {
      await delay(250);
      return;
    }
    await delay(100);
  }
  throw new Error("La composition d'attente n'est pas devenue prête pour la capture.");
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await delay(200);
  await waitForReady(cdp);
}

async function normalizeProofContent(cdp) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const message = document.querySelector('[data-message-breath]');
      const countdown = document.querySelector('.waiting-countdown-value');
      if (message) message.textContent = ${JSON.stringify(PROOF_MESSAGE)};
      if (countdown) countdown.textContent = ${JSON.stringify(PROOF_COUNTDOWN)};
    })()`,
  });
  await delay(100);
}

async function setViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(250);
}

async function capture(cdp, filename, normalizeContent = false, width = WIDTH, height = HEIGHT) {
  if (normalizeContent) await normalizeProofContent(cdp);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  const buffer = Buffer.from(screenshot.data, "base64");
  if (filename) {
    await writeFile(filename, buffer);
    await waitForFile(filename);
  }
  return buffer;
}

async function labeledFrame(filename, label) {
  const image = await sharp(filename).resize(PROOF_WIDTH, PROOF_HEIGHT).png().toBuffer();
  const overlay = Buffer.from(`<svg width="${PROOF_WIDTH}" height="${PROOF_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="360" height="54" rx="6" fill="#010A14" fill-opacity="0.84" stroke="#01F7FD" stroke-opacity="0.7"/>
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

async function buildDetailSheet() {
  const crops = [
    { label: "ANGLE HG", left: 0, top: 0, width: 260, height: 220 },
    { label: "ANGLE HD · SÉPARATION", left: 1540, top: 0, width: 380, height: 220 },
    { label: "ANGLE BG · SÉPARATION", left: 0, top: 860, width: 380, height: 220 },
    { label: "ANGLE BD", left: 1660, top: 860, width: 260, height: 220 },
    { label: "REPÈRE GAUCHE · y 702", left: 0, top: 552, width: 220, height: 300 },
    { label: "REPÈRE DROIT · y 324", left: 1700, top: 174, width: 220, height: 300 },
  ];
  const cells = await Promise.all(crops.map(async (crop) => {
    const image = await sharp(AFTER).extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
      .resize(480, 270, { fit: "contain", background: "#010A14" }).png().toBuffer();
    const overlay = Buffer.from(`<svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="12" width="300" height="34" rx="4" fill="#010A14" fill-opacity="0.88" stroke="#01F7FD" stroke-opacity="0.7"/>
      <text x="25" y="36" fill="#FAFBFB" font-family="Arial, sans-serif" font-size="17" font-weight="700">${crop.label}</text>
    </svg>`);
    return sharp(image).composite([{ input: overlay }]).png().toBuffer();
  }));
  await sharp({ create: { width: 1440, height: 540, channels: 4, background: "#010A14" } })
    .composite(cells.map((input, index) => ({ input, left: index % 3 * 480, top: Math.floor(index / 3) * 270 })))
    .png()
    .toFile(path.join(OUTPUT, "detail-inspection.png"));
}

async function main() {
  const health = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/health`);
  if (!health.ok) throw new Error(`Serveur local indisponible : HTTP ${health.status}`);

  await mkdir(OUTPUT, { recursive: true });
  const profile = await mkdtemp(path.join(tmpdir(), "les-waiting-r9-proof-"));
  const firstUrl = `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=0`;
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--app=${firstUrl}`,
  ], { windowsHide: true, stdio: "ignore" });

  const staticCaptures = [
    { phase: 0, filename: "after-phase-0.png" },
    { phase: 0.25, filename: "after-phase-25.png" },
    { phase: 0.5, filename: "after-phase-50.png" },
    { phase: 0.75, filename: "after-phase-75.png" },
    { phase: 0.9999, filename: "after-phase-99.png" },
  ];
  const demoFrames = [];

  try {
    const target = await waitForTarget();
    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.ready;
    await setViewport(cdp, WIDTH, HEIGHT);
    await waitForReady(cdp);

    for (let index = 0; index < staticCaptures.length; index += 1) {
      const item = staticCaptures[index];
      const url = `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=${item.phase}`;
      if (index > 0) await navigate(cdp, url);
      await capture(cdp, path.join(OUTPUT, item.filename), true);
    }

    await navigate(cdp, `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=0&guides=1`);
    await capture(cdp, path.join(OUTPUT, "guide-phase-0.png"), true);

    for (const viewport of [{ width: 1280, height: 720 }, { width: 960, height: 540 }]) {
      await setViewport(cdp, viewport.width, viewport.height);
      await navigate(cdp, `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=0`);
      await capture(cdp, path.join(OUTPUT, `preview-${viewport.width}x${viewport.height}.png`), true, viewport.width, viewport.height);
    }

    await setViewport(cdp, WIDTH, HEIGHT);

    await navigate(cdp, `${BASE_URL.replace(/\/$/, "")}/preview/attente`);
    await normalizeProofContent(cdp);
    const startedAt = performance.now();
    for (let index = 0; index < 40; index += 1) {
      const targetElapsed = index * 500;
      const remaining = targetElapsed - (performance.now() - startedAt);
      if (remaining > 0) await delay(remaining);
      demoFrames.push(await capture(cdp, null));
    }

    await cdp.send("Browser.close");
    cdp.close();
  } finally {
    if (!chrome.killed) chrome.kill();
    await delay(500);
    await rm(profile, { recursive: true, force: true });
  }

  const rawFrames = await Promise.all(demoFrames.map((buffer) =>
    sharp(buffer).resize(PROOF_WIDTH, PROOF_HEIGHT).ensureAlpha().raw().toBuffer()
  ));
  await sharp(Buffer.concat(rawFrames), {
    raw: {
      width: PROOF_WIDTH,
      height: PROOF_HEIGHT * rawFrames.length,
      channels: 4,
      pageHeight: PROOF_HEIGHT,
    },
  })
    .gif({ delay: Array(rawFrames.length).fill(500), loop: 0, effort: 4, dither: 0.8 })
    .toFile(path.join(OUTPUT, "motion-proof-20s.gif"));

  await buildContactSheet([
    { file: BEFORE, label: "AVANT · t = 0 s" },
    { file: AFTER, label: "APRÈS · t = 0 s" },
  ], path.join(OUTPUT, "before-after-phase-0.png"));

  await buildContactSheet([
    { file: path.join(OUTPUT, "after-phase-0.png"), label: "t = 0 s · minimum" },
    { file: path.join(OUTPUT, "after-phase-25.png"), label: "t = 3,75 s · maximum" },
    { file: path.join(OUTPUT, "after-phase-50.png"), label: "t = 7,50 s · retour" },
  ], path.join(OUTPUT, "motion-phases.png"));

  await buildDetailSheet();

  await copyFile(AFTER, path.join(ROOT, "public", "thumbnails", "attente.png"));

  const proofFiles = [
    ...staticCaptures.map((item) => item.filename),
    "guide-phase-0.png",
    "preview-1280x720.png",
    "preview-960x540.png",
    "before-after-phase-0.png",
    "motion-phases.png",
    "detail-inspection.png",
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
    canvas: { width: WIDTH, height: HEIGHT },
    loopSeconds: 15,
    breathPeriodSeconds: 7.5,
    layoutRevision: "les-da-2026-r9",
    anchors: {
      topLeft: [96, 72],
      topRight: [1824, 72],
      bottomLeft: [96, 1008],
      bottomRight: [1824, 1008],
      rightRail: [1824, 324],
      leftRail: [96, 702],
    },
    motionProofSeconds: 20,
    motionProofFps: 2,
    qualityDecisions: {
      cornerCoreOpacity: [0.86, 0.96],
      cornerHaloOpacity: [0.025, 0.07],
      cornerHaloBlurPx: 4,
      matrixWidthPx: 112,
      matrixAuthorityClearanceMinimumPx: 20,
    },
    proofContentOverride: {
      scope: "capture DOM only; no API or persisted state mutation",
      message: PROOF_MESSAGE,
      countdown: PROOF_COUNTDOWN,
    },
    seamHashesMatch: seamStart?.sha256 === seamEnd?.sha256,
    artifacts,
  }, null, 2)}\n`);
}

await main();
