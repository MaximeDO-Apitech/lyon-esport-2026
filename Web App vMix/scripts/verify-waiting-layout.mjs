import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import WebSocket from "ws";

const ROOT = process.cwd();
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9338;
const OUTPUT = path.join(ROOT, "captures", "waiting-r6", "layout-verification.json");

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/preview/attente"));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome n'a pas exposé la page de validation.");
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

const profile = await mkdtemp(path.join(tmpdir(), "les-waiting-layout-"));
const url = `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=0`;
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
  "--window-size=1920,1080",
  "--force-device-scale-factor=1",
  `--user-data-dir=${profile}`,
  url,
], { windowsHide: true, stdio: "ignore" });

try {
  const target = await waitForTarget();
  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await cdp.ready;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await cdp.send("Runtime.evaluate", {
      expression: "Boolean(document.querySelector('.waiting-countdown-value'))",
      returnByValue: true,
    });
    if (ready.result.value) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const evaluation = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const selectors = {
        stage: '.waiting-stage',
        logo: '.waiting-logo',
        message: '.waiting-message',
        countdown: '.waiting-countdown',
        ribbonTopLeft: '.waiting-ribbon-top-left',
        ribbonRight: '.waiting-ribbon-right',
        brackets: '.waiting-information-brackets'
      };
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left, top: box.top, right: box.right, bottom: box.bottom,
          width: box.width, height: box.height,
          cssWidth: parseFloat(style.width), cssHeight: parseFloat(style.height),
          zIndex: style.zIndex, opacity: style.opacity, filter: style.filter
        };
      };
      const result = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, rect(selector)]));
      const logoImage = document.querySelector('.waiting-logo img');
      if (logoImage) {
        const box = logoImage.getBoundingClientRect();
        const source = { width: 2709, height: 1348 };
        const alpha = { left: 463, top: 246, width: 1698, height: 895 };
        result.logoVisible = {
          left: box.left + box.width * alpha.left / source.width,
          top: box.top + box.height * alpha.top / source.height,
          right: box.left + box.width * (alpha.left + alpha.width) / source.width,
          bottom: box.top + box.height * (alpha.top + alpha.height) / source.height,
          width: box.width * alpha.width / source.width,
          height: box.height * alpha.height / source.height,
          measurement: 'alpha bounds of the canonical logo source'
        };
      }
      result.counts = {
        matrices: document.querySelectorAll('.waiting-matrix').length,
        rails: document.querySelectorAll('.waiting-dot-rail').length,
        localBrackets: document.querySelectorAll('.waiting-information-bracket').length,
        legacyViewportAngles: document.querySelectorAll('.waiting-angle').length,
        legacyFrameLines: document.querySelectorAll('.waiting-frame-line').length
      };
      result.content = {
        message: document.querySelector('.waiting-message')?.textContent?.trim() ?? null,
        countdown: document.querySelector('.waiting-countdown-value')?.textContent?.trim() ?? null
      };
      return result;
    })()`,
  });
  await cdp.send("Browser.close");
  cdp.close();

  const layout = evaluation.result.value;
  const designScale = layout.stage.width / layout.stage.cssWidth;
  const editorial = ["logoVisible", "message", "countdown"];
  const decorations = ["ribbonTopLeft", "ribbonRight"];
  const clearance = (a, b) => {
    const dx = Math.max(a.left - b.right, b.left - a.right, 0);
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
    return Math.hypot(dx, dy);
  };
  const clearances = [];
  for (const decoration of decorations) {
    for (const item of editorial) {
      const screenPixels = clearance(layout[decoration], layout[item]);
      const designPixels = screenPixels / designScale;
      const effectiveDesignPixels = designPixels - 13;
      clearances.push({ decoration, editorial: item, screenPixels, designPixels, effectiveDesignPixels, passes48px: effectiveDesignPixels >= 48 });
    }
  }

  const assertions = {
    stageIs1920x1080: layout.stage.cssWidth === 1920 && layout.stage.cssHeight === 1080,
    allDecorativeClearancesPass48px: clearances.every((entry) => entry.passes48px),
    exactCompactMatrices: layout.counts.matrices === 2,
    exactShortRails: layout.counts.rails === 2,
    oneLocalBracketSet: layout.counts.localBrackets === 4,
    noLegacyViewportAngles: layout.counts.legacyViewportAngles === 0,
    noLegacyFrameLines: layout.counts.legacyFrameLines === 0,
  };
  const passed = Object.values(assertions).every(Boolean);

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    url,
    previewScale: designScale,
    distortionAllowancePixels: 13,
    layout,
    clearances,
    assertions,
    passed,
  }, null, 2)}\n`);

  if (!passed) process.exitCode = 1;
} finally {
  if (!chrome.killed) chrome.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
