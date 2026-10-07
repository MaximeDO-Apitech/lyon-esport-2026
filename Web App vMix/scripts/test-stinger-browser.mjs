import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const PROFILE_ROOT = path.join(tmpdir(), `les-stinger-browser-test-${process.pid}`);
const PORT_ROOT = 9800 + (process.pid % 80);

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connexion DevTools impossible.")), 5000);
      this.socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Délai DevTools dépassé : ${method}.`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function waitForBrowser(port, chrome, readErrors) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (chrome.exitCode !== null) throw new Error(`Chrome s’est arrêté avec le code ${chrome.exitCode}.\n${readErrors()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      if ((await response.json()).webSocketDebuggerUrl) return;
    } catch {}
    await wait(50);
  }
  throw new Error(`Endpoint DevTools indisponible.\n${readErrors()}`);
}

function stopChrome(chrome) {
  if (process.platform === "win32" && chrome.pid) {
    spawnSync("taskkill", ["/pid", String(chrome.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } else {
    chrome.kill("SIGKILL");
  }
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Erreur JavaScript : ${result.exceptionDetails.text}`);
  return result.result?.value;
}

async function waitForValue(cdp, expression, predicate, label) {
  const started = Date.now();
  let lastValue;
  while (Date.now() - started < 25000) {
    try {
      lastValue = await evaluate(cdp, expression);
      if (predicate(lastValue)) return lastValue;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("context")) throw error;
    }
    await wait(100);
  }
  throw new Error(`${label} indisponible : ${JSON.stringify(lastValue)}.`);
}

async function withPage(testCase, index, action) {
  const port = PORT_ROOT + index;
  const profile = path.join(PROFILE_ROOT, testCase.name);
  await mkdir(profile, { recursive: true });
  const chromeBase = BASE_URL.replace(/\/$/, "").replace("://localhost", "://[::1]");
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-proxy-server",
    "--autoplay-policy=no-user-gesture-required",
    "--default-background-color=00000000",
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--app=${chromeBase}${testCase.path}`,
  ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const errors = [];
  chrome.stderr.on("data", (chunk) => errors.push(chunk));
  let cdp;
  try {
    await waitForBrowser(port, chrome, () => Buffer.concat(errors).toString("utf8"));
    await wait(2000);
    const listedTargets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const currentTarget = listedTargets.find((candidate) => candidate.type === "page" && candidate.url.includes(testCase.path.split("?")[0]));
    if (!currentTarget) throw new Error(`Cible Chrome ${testCase.name} introuvable après navigation : ${JSON.stringify(listedTargets.map(({ type, url }) => ({ type, url })))}.\n${Buffer.concat(errors).toString("utf8")}`);
    cdp = new Cdp(currentTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call("Runtime.enable");
    return await action(cdp);
  } finally {
    cdp?.close();
    stopChrome(chrome);
  }
}

async function alphaAt(cdp, timeMs) {
  return evaluate(cdp, `(async () => {
    const api = window.__LES_STINGER__;
    const video = document.querySelector('video');
    if (!api || !video) throw new Error('API ou vidéo indisponible');
    const seek = await api.seek(${timeMs});
    if (!seek.accepted) throw new Error('Seek refusé');
    await new Promise((resolve) => setTimeout(resolve, 120));
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 270;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255, max = 0, nonZero = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      const alpha = pixels[offset];
      if (alpha < min) min = alpha;
      if (alpha > max) max = alpha;
      if (alpha > 0) nonZero += 1;
    }
    return { min, max, nonZero, width: canvas.width, height: canvas.height };
  })()`, true);
}

async function testOutput(variant, index) {
  const durationMs = variant === "short" ? 2000 : 5000;
  const frameCount = variant === "short" ? 120 : 300;
  const finalFrameTimeMs = durationMs - 1;
  return withPage({ name: variant, path: `/output/stinger?variant=${variant}` }, index, async (cdp) => {
    const initial = await waitForValue(
      cdp,
      `(() => ({ ready: window.__LES_STINGER__?.ready ?? false, status: window.__LES_STINGER__?.status ?? null, timeMs: (document.querySelector('video')?.currentTime ?? 0) * 1000, videoReadyState: document.querySelector('video')?.readyState ?? 0 }))()`,
      (value) => value?.ready && value.videoReadyState >= 2,
      `Sortie ${variant}`,
    );
    const first = await alphaAt(cdp, 0);
    const cut = await alphaAt(cdp, 1300);
    const partner = variant === "long" ? await alphaAt(cdp, 3000) : null;
    const last = await alphaAt(cdp, finalFrameTimeMs);
    if (first.max !== 0 || cut.min !== 255 || last.max !== 0 || (partner && partner.min !== 255)) {
      throw new Error(`Alpha navigateur ${variant} incorrect : ${JSON.stringify({ first, cut, partner, last })}`);
    }
    const playback = await evaluate(cdp, `(async () => {
      const api = window.__LES_STINGER__;
      const video = document.querySelector('video');
      await api.seek(0);
      const firstAccepted = api.play(1);
      const secondIgnored = api.play(1) === false;
      const playingStatus = api.status;
      video.dispatchEvent(new Event('ended'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const returnsToReady = api.status === 'ready';
      const successiveAccepted = api.play(1);
      api.stop();
      return { firstAccepted, secondIgnored, playingStatus, returnsToReady, successiveAccepted };
    })()`, true);
    if (!playback.firstAccepted || !playback.secondIgnored || playback.playingStatus !== "playing" || !playback.returnsToReady || !playback.successiveAccepted) {
      throw new Error(`Cycle de lecture ${variant} incorrect : ${JSON.stringify(playback)}`);
    }
    const initialDoesNotReplay = initial.status === "ready" && initial.timeMs < 50;
    if (!initialDoesNotReplay) throw new Error(`État initial ${variant} inattendu : ${JSON.stringify(initial)}`);
    return {
      variant,
      durationMs,
      frameCount,
      initialDoesNotReplay,
      alpha: { first, cut, partner, last },
      playback,
    };
  });
}

async function testPreview(index) {
  return withPage({ name: "preview", path: "/preview/stinger" }, index, async (cdp) => {
    await waitForValue(cdp, `(() => ({ status: document.querySelector('section span')?.textContent, videoReadyState: document.querySelector('video')?.readyState ?? 0 }))()`, (value) => value?.status === "ready" && value.videoReadyState >= 2, "Aperçu");
    const initialPreview = await evaluate(cdp, `(async () => {
      const input = document.querySelector('input[type="range"]');
      input.scrollIntoView({ block: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = input.getBoundingClientRect();
      return { source: document.querySelector('[data-testid="stinger-test-source"]')?.textContent, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    })()`, true);
    await evaluate(cdp, `(() => {
      const input = document.querySelector('input[type="range"]');
      const reactPropsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
      const onChange = reactPropsKey ? input[reactPropsKey]?.onChange : null;
      if (typeof onChange !== 'function') throw new Error('Gestionnaire React du scrub introuvable');
      onChange({ target: { value: '1300' } });
      return true;
    })()`);
    await wait(300);
    return evaluate(cdp, `(async () => {
      const sourceAtCut = document.querySelector('[data-testid="stinger-test-source"]')?.textContent;
      const rangeValue = document.querySelector('input[type="range"]')?.value;
      const buttons = [...document.querySelectorAll('[role="group"][aria-label="Variante du stinger"] button')];
      const variants = buttons.map((button) => button.textContent.trim());
      const backgrounds = [...document.querySelectorAll('select option')].map((option) => option.value);
      buttons[1].click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const longSelected = document.querySelector('video')?.getAttribute('src')?.includes('long-5s') ?? false;
      return { sourceAtCut, rangeValue, variants, backgrounds, longSelected, isolatedFromProgram: true };
    })()`, true).then((report) => {
      report.sourceBeforeCut = initialPreview.source;
      report.controlRect = initialPreview.rect;
      if (report.sourceBeforeCut !== "A" || report.sourceAtCut !== "B" || report.rangeValue !== "1300" || report.variants.length !== 2 || !report.backgrounds.includes("contrast") || !report.longSelected) {
        throw new Error(`Aperçu incorrect : ${JSON.stringify(report)}`);
      }
      return report;
    });
  });
}

async function graphicsRevision() {
  const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/graphics/state`);
  if (!response.ok) throw new Error(`État graphique indisponible : HTTP ${response.status}.`);
  return (await response.json()).state.revision;
}

async function main() {
  const health = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/health`);
  if (!health.ok) throw new Error(`Serveur local indisponible : HTTP ${health.status}.`);
  const beforeRevision = await graphicsRevision();
  await rm(PROFILE_ROOT, { recursive: true, force: true });
  await mkdir(PROFILE_ROOT, { recursive: true });
  try {
    const short = await testOutput("short", 0);
    const long = await testOutput("long", 1);
    const preview = await testPreview(2);
    const afterRevision = await graphicsRevision();
    if (afterRevision !== beforeRevision) throw new Error(`Le banc a modifié l’état programme (${beforeRevision} → ${afterRevision}).`);
    console.log(JSON.stringify({ short, long, preview, graphicsStateRevisionUnchanged: beforeRevision }, null, 2));
  } finally {
    await rm(PROFILE_ROOT, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
