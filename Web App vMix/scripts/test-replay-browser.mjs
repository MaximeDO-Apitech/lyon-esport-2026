import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const PORT = 9980 + (process.pid % 100);
const PROFILE = path.join(tmpdir(), "les-replay-browser-test-" + process.pid);

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
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools fermé."));
      this.pending.clear();
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Erreur renderer replay.");
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function waitForPage() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + PORT + "/json");
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Page replay Chrome introuvable.");
}

async function waitFor(cdp, expression, label) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      if (await cdp.eval(expression)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Délai dépassé : " + label);
}

async function navigate(cdp, url, readyExpression) {
  await cdp.call("Page.navigate", { url });
  await waitFor(cdp, readyExpression, url);
}

async function readState(pathname) {
  const base = BASE_URL.replace(/\/$/, "");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(base + pathname);
    const payload = await response.json();
    if (response.ok && payload.state) return payload.state;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("État local indisponible : " + pathname);
}

async function revisions() {
  const graphics = await readState("/api/graphics/state");
  const replay = await readState("/api/replay/state");
  return { graphics: graphics.revision, replay: replay.revision };
}

async function main() {
  const base = BASE_URL.replace(/\/$/, "");
  const before = await revisions();
  await rm(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--mute-audio",
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + PROFILE,
    base + "/output/replay-in",
  ], { windowsHide: true, stdio: "ignore" });

  let cdp;
  try {
    const page = await waitForPage();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call("Runtime.enable");
    await cdp.call("Page.enable");
    await waitFor(cdp, "Boolean(window.__LES_REPLAY_TRANSITION__?.ready)", "entrée replay ready");

    const entryInfo = await cdp.eval("({id:window.__LES_REPLAY_TRANSITION__.id,duration:window.__LES_REPLAY_TRANSITION__.durationMs,kind:window.__LES_REPLAY_TRANSITION__.kind})");
    if (entryInfo.id !== "replay-in-les" || entryInfo.duration !== 800 || entryInfo.kind !== "in") {
      throw new Error("Métadonnées entrée incorrectes : " + JSON.stringify(entryInfo));
    }
    const doubleTrigger = await cdp.eval("[window.__LES_REPLAY_TRANSITION__.play(1),window.__LES_REPLAY_TRANSITION__.play(1),window.__LES_REPLAY_TRANSITION__.status]");
    if (doubleTrigger[0] !== true || doubleTrigger[1] !== false || doubleTrigger[2] !== "playing") {
      throw new Error("Double déclenchement entrée incorrect : " + JSON.stringify(doubleTrigger));
    }
    await new Promise((resolve) => setTimeout(resolve, 950));
    if (await cdp.eval("window.__LES_REPLAY_TRANSITION__.status") !== "ready") {
      throw new Error("L’entrée replay ne revient pas à ready.");
    }
    const entryCut = await cdp.eval("window.__LES_REPLAY_TRANSITION__.seek(400)");
    if (!entryCut.accepted || Math.abs(entryCut.timeMs - 400) > 1) {
      throw new Error("Recherche au point de coupe entrée impossible.");
    }

    await cdp.call("Page.reload", { ignoreCache: false });
    await waitFor(cdp, "Boolean(window.__LES_REPLAY_TRANSITION__?.ready)", "entrée replay après reconnexion");
    if (await cdp.eval("window.__LES_REPLAY_TRANSITION__.status") !== "ready") {
      throw new Error("La reconnexion rejoue l’entrée.");
    }

    await navigate(
      cdp,
      base + "/output/replay-out",
      "Boolean(window.__LES_REPLAY_TRANSITION__?.ready && window.__LES_REPLAY_TRANSITION__.kind === 'out')",
    );
    const exitInfo = await cdp.eval("({id:window.__LES_REPLAY_TRANSITION__.id,duration:window.__LES_REPLAY_TRANSITION__.durationMs})");
    if (exitInfo.id !== "replay-out-les" || exitInfo.duration !== 600) {
      throw new Error("Métadonnées sortie incorrectes : " + JSON.stringify(exitInfo));
    }
    const exitCut = await cdp.eval("window.__LES_REPLAY_TRANSITION__.seek(300)");
    if (!exitCut.accepted || Math.abs(exitCut.timeMs - 300) > 1) {
      throw new Error("Recherche au point de coupe sortie impossible.");
    }

    await navigate(
      cdp,
      base + "/output/replay-marker?force=visible&corner=top-right&offsetX=120&offsetY=80",
      "Boolean(window.__LES_REPLAY_MARKER__?.ready)",
    );
    const marker = await cdp.eval("(() => { const card=document.querySelector('[role=img][aria-label=Replay]'); const rect=card.getBoundingClientRect(); return {api:window.__LES_REPLAY_MARKER__,viewport:{width:innerWidth,height:innerHeight},rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},text:card.textContent.replace(/\\s+/g,' ').trim()}; })()");
    if (marker.api.placement.corner !== "top-right" || marker.api.placement.offsetX !== 120 || marker.api.placement.offsetY !== 80) {
      throw new Error("Placement marqueur incorrect : " + JSON.stringify(marker));
    }
    const markerScale = Math.min(marker.viewport.width / 1920, marker.viewport.height / 1080);
    const markerCanvasLeft = (marker.viewport.width - 1920 * markerScale) / 2;
    const markerCanvasTop = (marker.viewport.height - 1080 * markerScale) / 2;
    const expectedRect = {
      x: markerCanvasLeft + (1920 - 120 - 260) * markerScale,
      y: markerCanvasTop + 80 * markerScale,
      width: 260 * markerScale,
      height: 68 * markerScale,
    };
    if (Object.keys(expectedRect).some((key) => Math.abs(marker.rect[key] - expectedRect[key]) > 1)) {
      throw new Error("Dimensions marqueur incorrectes : " + JSON.stringify({ actual: marker.rect, expected: expectedRect }));
    }
    if (!marker.text.includes("REPLAY")) throw new Error("Libellé REPLAY absent.");

    await navigate(
      cdp,
      base + "/preview/replay",
      "Boolean(document.querySelector('input[aria-label=\\\"Position dans le scénario replay\\\"]'))",
    );
    const previewExpression = "(async()=>{const input=document.querySelector('input[aria-label=\\\"Position dans le scénario replay\\\"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const readAt=async(value)=>{const apply=()=>{setter.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};apply();await new Promise(resolve=>setTimeout(resolve,80));apply();await new Promise(resolve=>setTimeout(resolve,80));const sourceNode=document.querySelector('[data-source]');return{source:sourceNode?.getAttribute('data-source'),marker:Boolean(sourceNode?.parentElement?.querySelector('[data-composition-id=\\\"replay-marker-les\\\"]'))};};return{beforeEntryCut:await readAt(399),atEntryCut:await readAt(400),beforeAngleChange:await readAt(3399),atAngleChange:await readAt(3400),beforeExitCut:await readAt(7099),atExitCut:await readAt(7100),markerBeforeOut:await readAt(6949),markerAfterOut:await readAt(6950),earlyExitButton:[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Sortie anticipée'))};})()";
    const previewChecks = await cdp.eval(previewExpression);
    if (previewChecks.beforeEntryCut.source !== "A" || previewChecks.atEntryCut.source !== "B") {
      throw new Error("Coupe entrée du banc incorrecte : " + JSON.stringify(previewChecks));
    }
    if (previewChecks.beforeAngleChange.source !== "B" || previewChecks.atAngleChange.source !== "C") {
      throw new Error("Changement B vers C incorrect : " + JSON.stringify(previewChecks));
    }
    if (!previewChecks.beforeAngleChange.marker || !previewChecks.atAngleChange.marker) {
      throw new Error("Le marqueur n’est pas stable pendant B vers C.");
    }
    if (previewChecks.beforeExitCut.source !== "C" || previewChecks.atExitCut.source !== "A") {
      throw new Error("Coupe sortie du banc incorrecte : " + JSON.stringify(previewChecks));
    }
    if (!previewChecks.markerBeforeOut.marker || previewChecks.markerAfterOut.marker) {
      throw new Error("La sortie du marqueur sous couverture est incorrecte.");
    }
    if (!previewChecks.earlyExitButton) throw new Error("Commande de sortie anticipée absente.");

    const after = await revisions();
    if (after.graphics !== before.graphics || after.replay !== before.replay) {
      throw new Error("Le test a modifié un état serveur : " + JSON.stringify({ before, after }));
    }

    console.log(JSON.stringify({
      transitionsReadyAfterPreload: true,
      doubleTriggerIgnored: true,
      reconnectDoesNotReplay: true,
      entryCutMs: 400,
      exitCutMs: 300,
      markerTopRightProof: marker.rect,
      previewSequence: "A → B → C → A",
      markerStableAcrossBtoC: true,
      earlyExitControlPresent: true,
      stateRevisionsUnchanged: before,
    }, null, 2));
  } finally {
    cdp?.close();
    chrome.kill();
    await Promise.race([
      rm(PROFILE, { recursive: true, force: true }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
