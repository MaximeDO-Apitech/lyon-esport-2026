import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:3000";
const PORT = 9900 + (process.pid % 80);
const PROFILE = path.join(tmpdir(), `les-stinger-browser-test-${process.pid}`);

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
    const result = await this.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Erreur renderer.");
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function waitForPage() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.url.includes("/output/stinger"));
      if (page) return page;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Page stinger Chrome introuvable.");
}

async function waitForReady(cdp) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      if (await cdp.eval("Boolean(window.__LES_STINGER__?.ready)")) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Le stinger n’atteint pas ready.");
}

async function stateRevision() {
  const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/graphics/state`);
  const envelope = await response.json();
  return envelope.state.revision;
}

async function main() {
  const beforeRevision = await stateRevision();
  await rm(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--mute-audio",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `${BASE_URL.replace(/\/$/, "")}/output/stinger`,
  ], { windowsHide: true, stdio: "ignore" });

  let cdp;
  try {
    const page = await waitForPage();
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call("Runtime.enable");
    await waitForReady(cdp);

    const doubleTrigger = await cdp.eval("[window.__LES_STINGER__.play(1), window.__LES_STINGER__.play(1), window.__LES_STINGER__.status]");
    if (doubleTrigger[0] !== true || doubleTrigger[1] !== false || doubleTrigger[2] !== "playing") {
      throw new Error(`Double déclenchement incorrect : ${JSON.stringify(doubleTrigger)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const completed = await cdp.eval("({status:window.__LES_STINGER__.status,time:window.__LES_STINGER__.durationMs})");
    if (completed.status !== "ready") throw new Error(`Fin de lecture incorrecte : ${JSON.stringify(completed)}`);

    const secondRunAccepted = await cdp.eval("window.__LES_STINGER__.play(1)");
    if (secondRunAccepted !== true) throw new Error("Le déclenchement suivant n’est pas accepté.");
    await cdp.eval("window.__LES_STINGER__.stop()");

    await cdp.call("Page.reload", { ignoreCache: false });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await waitForReady(cdp);
    const afterReconnect = await cdp.eval("({status:window.__LES_STINGER__.status,time:window.__LES_STINGER__.seek(0)})");
    if (afterReconnect.status !== "ready") throw new Error(`Reconnexion incorrecte : ${JSON.stringify(afterReconnect)}`);

    await cdp.call("Page.navigate", { url: `${BASE_URL.replace(/\/$/, "")}/preview/stinger` });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        if (await cdp.eval("Boolean(document.querySelector('input[aria-label^=\\\"Temps du stinger\\\"]'))")) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const sourceSwitch = await cdp.eval(`(async () => {
      const input = document.querySelector('input[aria-label^="Temps du stinger"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const readAt = async (value) => {
        setter.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.querySelector('[data-testid="stinger-test-source"]')?.textContent;
      };
      return [await readAt(599), await readAt(600)];
    })()`);
    if (sourceSwitch[0] !== "A" || sourceSwitch[1] !== "B") {
      throw new Error(`Bascule source incorrecte : ${JSON.stringify(sourceSwitch)}`);
    }
    const afterRevision = await stateRevision();
    if (afterRevision !== beforeRevision) throw new Error(`Le test a modifié l’état programme (${beforeRevision} → ${afterRevision}).`);
    console.log(JSON.stringify({
      readyAfterPreload: true,
      doubleTrigger: { firstAccepted: true, secondIgnored: true },
      returnsToReady: true,
      successiveTriggerAccepted: true,
      reconnectDoesNotReplay: true,
      previewSwitchesAtoBAt600ms: true,
      graphicsStateRevisionUnchanged: beforeRevision,
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
