import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const OUTPUT = path.join(ROOT, "captures", "waiting-r9", "layout-verification.json");
const BASELINE = path.join(ROOT, "captures", "waiting-r8", "layout-verification.json");
const RAIL_SOURCE = path.join(ROOT, "public", "assets", "Ligne-points-renforcee.svg");
const PHASE_URL = (phase, guides = false) => `${BASE_URL.replace(/\/$/, "")}/preview/attente?freeze=${phase}${guides ? "&guides=1" : ""}`;
const OUTPUT_URL = `${BASE_URL.replace(/\/$/, "")}/output/attente`;
const TARGET = {
  width: 1920,
  height: 1080,
  frame: { left: 96, right: 1824, top: 72, bottom: 1008 },
  rails: { right: { x: 1824, y: 324 }, left: { x: 96, y: 702 }, width: 18, height: 200 },
  cornerAuthority: {
    topRight: { left: 1732, top: 72, right: 1824, bottom: 164 },
    bottomLeft: { left: 96, top: 916, right: 188, bottom: 1008 },
  },
  matrices: { width: 112, minimumAuthorityClearance: 20 },
};
const VIEWPORTS = [
  { width: 1920, height: 1080, expectedScale: 1 },
  { width: 1280, height: 720, expectedScale: 2 / 3 },
  { width: 960, height: 540, expectedScale: 0.5 },
];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/preview/attente"));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await delay(100);
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

async function waitForReady(cdp) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const logo = document.querySelector('.waiting-logo img');
        const cornerImages = [...document.querySelectorAll('.waiting-frame-corner img')];
        const rails = [...document.querySelectorAll('.waiting-dot-rail img')];
        return Boolean(
          document.querySelector('.waiting-stage') &&
          document.querySelector('[data-message-breath]')?.textContent?.trim() &&
          logo?.complete &&
          cornerImages.length === 8 && cornerImages.every((image) => image.complete) &&
          rails.length === 2 && rails.every((image) => image.complete) &&
          document.fonts.status === 'loaded'
        );
      })()`,
      returnByValue: true,
    });
    if (ready.result.value) {
      await delay(200);
      return;
    }
    await delay(100);
  }
  throw new Error("La composition d'attente n'est pas devenue prête.");
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await delay(200);
  await waitForReady(cdp);
}

async function evaluate(cdp, expression) {
  const evaluation = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  if (evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.text);
  return evaluation.result.value;
}

async function setViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(250);
}

const layoutExpression = `(() => {
  const stage = document.querySelector('.waiting-stage');
  const stageBox = stage.getBoundingClientRect();
  const stageStyle = getComputedStyle(stage);
  const scale = stageBox.width / parseFloat(stageStyle.width);
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: (box.left - stageBox.left) / scale,
      top: (box.top - stageBox.top) / scale,
      right: (box.right - stageBox.left) / scale,
      bottom: (box.bottom - stageBox.top) / scale,
      width: box.width / scale,
      height: box.height / scale,
      cssWidth: parseFloat(style.width),
      cssHeight: parseFloat(style.height),
      opacity: parseFloat(style.opacity),
      transform: style.transform,
      filter: style.filter,
    };
  };
  const anchor = (selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { x: (box.left - stageBox.left) / scale, y: (box.top - stageBox.top) / scale };
  };
  const center = (selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return {
      x: (box.left + box.width / 2 - stageBox.left) / scale,
      y: (box.top + box.height / 2 - stageBox.top) / scale,
    };
  };
  const orientations = Object.fromEntries(
    [...document.querySelectorAll('.waiting-frame-corner')].map((corner) => [
      [...corner.classList].find((name) => name.startsWith('waiting-frame-corner-') && name !== 'waiting-frame-corner-orientation'),
      getComputedStyle(corner.querySelector('.waiting-frame-corner-orientation')).transform,
    ]),
  );
  const railSvg = document.querySelector('.waiting-dot-rail img');
  return {
    stage: rect('.waiting-stage'),
    logo: rect('.waiting-logo'),
    messageLayout: rect('.waiting-message'),
    messageBreath: rect('[data-message-breath]'),
    countdown: rect('.waiting-countdown'),
    ribbonTopLeft: rect('.waiting-ribbon-top-left'),
    ribbonRight: rect('.waiting-ribbon-right'),
    matrixTopRight: rect('.waiting-matrix-top-right'),
    matrixBottomLeft: rect('.waiting-matrix-bottom-left'),
    railLeft: rect('.waiting-dot-rail-left'),
    railRight: rect('.waiting-dot-rail-right'),
    railCenters: { left: center('.waiting-dot-rail-left'), right: center('.waiting-dot-rail-right') },
    cornerCore: rect('.waiting-frame-corner-core'),
    cornerHalo: rect('.waiting-frame-corner-halo'),
    cornerStyles: {
      coreFilter: getComputedStyle(document.querySelector('.waiting-frame-corner-core')).filter,
      haloFilter: getComputedStyle(document.querySelector('.waiting-frame-corner-halo')).filter,
      supportOpacity: parseFloat(getComputedStyle(document.querySelector('.waiting-frame-corner'), '::before').opacity),
      supportBackground: getComputedStyle(document.querySelector('.waiting-frame-corner'), '::before').backgroundImage,
    },
    cornerAnchors: {
      topLeft: anchor('.waiting-frame-corner-top-left'),
      topRight: anchor('.waiting-frame-corner-top-right'),
      bottomLeft: anchor('.waiting-frame-corner-bottom-left'),
      bottomRight: anchor('.waiting-frame-corner-bottom-right'),
    },
    orientations,
    sourceGeometry: {
      cornerAsset: { width: 1105, height: 1243, apexX: 847, apexY: 258, coreHorizontalPixels: 660, coreVerticalPixels: 799, coreThicknessPixels: 43 },
      cornerRenderedWidth: parseFloat(getComputedStyle(document.querySelector('.waiting-frame-corner-core')).width),
      railAsset: railSvg?.getAttribute('src'),
    },
    counts: {
      matrices: document.querySelectorAll('.waiting-matrix').length,
      rails: document.querySelectorAll('.waiting-dot-rail').length,
      frameCorners: document.querySelectorAll('.waiting-frame-corner').length,
      cornerCores: document.querySelectorAll('[data-frame-corner-core]').length,
      cornerHalos: document.querySelectorAll('[data-frame-corner-halo]').length,
      guides: document.querySelectorAll('.waiting-layout-guides').length,
      legacyInformationBrackets: document.querySelectorAll('.waiting-information-bracket').length,
      legacyViewportAngles: document.querySelectorAll('.waiting-angle').length,
      legacyFrameLines: document.querySelectorAll('.waiting-frame-line').length,
    },
    content: {
      message: document.querySelector('.waiting-message-breath')?.textContent?.trim() ?? null,
      countdown: document.querySelector('.waiting-countdown-value')?.textContent?.trim() ?? null,
    },
    layoutRevision: stage.dataset.layoutRevision,
    previewScale: scale,
  };
})()`;

function closeTo(actual, expected, tolerance = 0.1) {
  return Math.abs(actual - expected) <= tolerance;
}

function samePoint(actual, expected, tolerance = 0.1) {
  return closeTo(actual.x, expected.x, tolerance) && closeTo(actual.y, expected.y, tolerance);
}

function rectanglesDistance(a, b) {
  const dx = Math.max(a.left - b.right, b.left - a.right, 0);
  const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
  return Math.hypot(dx, dy);
}

function protectedRectMatches(actual, baseline, tolerance = 0.2) {
  return ["left", "top", "width", "height"].every((key) => closeTo(actual[key], baseline[key], tolerance));
}

const baseline = JSON.parse(await readFile(BASELINE, "utf8"));
const railSvg = await readFile(RAIL_SOURCE, "utf8");
const circleTags = [...railSvg.matchAll(/<circle\b([^>]*)\/>/g)].map((match) => match[1]);
const attribute = (tag, name) => Number(tag.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
const railSourceGeometry = {
  terminalAxisX: attribute(circleTags[0], "cx"),
  terminalDiameter: attribute(circleTags[0], "r") * 2,
  dotAxesX: circleTags.slice(1).map((tag) => attribute(tag, "cx")),
  dotDiameters: circleTags.slice(1).map((tag) => attribute(tag, "r") * 2),
  dotCentersY: circleTags.slice(1).map((tag) => attribute(tag, "cy")),
  crossAxisX: 9,
  crossSpan: 14,
  crossStroke: Number(railSvg.match(/stroke-width="([^"]+)"/)?.[1]),
  crossFitsViewBox: railSvg.includes("M2 191.75H16M9 184.75V198.75"),
};

const profile = await mkdtemp(path.join(tmpdir(), "les-waiting-layout-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--hide-scrollbars",
  "--mute-audio",
  "--no-proxy-server",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--window-size=1920,1080",
  "--force-device-scale-factor=1",
  `--user-data-dir=${profile}`,
  `--app=${PHASE_URL("0")}`,
], { windowsHide: true, stdio: "ignore" });

try {
  const target = await waitForTarget();
  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  await setViewport(cdp, VIEWPORTS[0]);
  await waitForReady(cdp);

  const layout = await evaluate(cdp, layoutExpression);

  const responsiveMeasurements = [];
  for (const viewport of VIEWPORTS) {
    await setViewport(cdp, viewport);
    responsiveMeasurements.push({ viewport, ...(await evaluate(cdp, layoutExpression)) });
  }
  await setViewport(cdp, VIEWPORTS[0]);

  const phaseStates = [];
  for (const phase of [0, 0.25, 0.5, 0.9999]) {
    await navigate(cdp, PHASE_URL(String(phase)));
    phaseStates.push(await evaluate(cdp, `(() => {
      const stage = document.querySelector('.waiting-stage').getBoundingClientRect();
      const scale = stage.width / 1920;
      const center = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: (box.left + box.width / 2 - stage.left) / scale, y: (box.top + box.height / 2 - stage.top) / scale };
      };
      const anchor = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: (box.left - stage.left) / scale, y: (box.top - stage.top) / scale };
      };
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {
          left: (box.left - stage.left) / scale,
          top: (box.top - stage.top) / scale,
          right: (box.right - stage.left) / scale,
          bottom: (box.bottom - stage.top) / scale,
          width: box.width / scale,
          height: box.height / scale,
          opacity: parseFloat(getComputedStyle(document.querySelector(selector)).opacity),
        };
      };
      const message = document.querySelector('[data-message-breath]');
      const core = document.querySelector('[data-frame-corner-core]');
      const halo = document.querySelector('[data-frame-corner-halo]');
      return {
        phase: ${phase}, seconds: ${phase} * 15,
        messageOpacity: parseFloat(getComputedStyle(message).opacity),
        messageTransform: getComputedStyle(message).transform,
        messageWidth: message.getBoundingClientRect().width / scale,
        cornerCoreOpacity: parseFloat(getComputedStyle(core).opacity),
        cornerHaloOpacity: parseFloat(getComputedStyle(halo).opacity),
        cornerOrientation: getComputedStyle(document.querySelector('.waiting-frame-corner-top-left .waiting-frame-corner-orientation')).transform,
        railCenters: { left: center('.waiting-dot-rail-left'), right: center('.waiting-dot-rail-right') },
        cornerAnchors: { topLeft: anchor('.waiting-frame-corner-top-left'), bottomRight: anchor('.waiting-frame-corner-bottom-right') },
        matrices: { topRight: rect('.waiting-matrix-top-right'), bottomLeft: rect('.waiting-matrix-bottom-left') },
      };
    })()`));
  }

  await navigate(cdp, PHASE_URL("0", true));
  const guideCount = await evaluate(cdp, "document.querySelectorAll('.waiting-layout-guides').length");

  await navigate(cdp, OUTPUT_URL);
  const outputGuideCount = await evaluate(cdp, "document.querySelectorAll('.waiting-layout-guides').length");
  const outputSamples = [];
  for (let index = 0; index <= 30; index += 1) {
    outputSamples.push(await evaluate(cdp, `(() => {
      const stage = document.querySelector('.waiting-stage').getBoundingClientRect();
      const scale = stage.width / 1920;
      const center = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: (box.left + box.width / 2 - stage.left) / scale, y: (box.top + box.height / 2 - stage.top) / scale };
      };
      const message = document.querySelector('[data-message-breath]');
      const core = document.querySelector('[data-frame-corner-core]');
      const logo = document.querySelector('.waiting-logo');
      const countdown = document.querySelector('.waiting-countdown');
      return {
        elapsedSeconds: ${index} * 0.25,
        messageOpacity: parseFloat(getComputedStyle(message).opacity),
        messageTransform: getComputedStyle(message).transform,
        cornerCoreOpacity: parseFloat(getComputedStyle(core).opacity),
        logoOpacity: parseFloat(getComputedStyle(logo).opacity),
        logoTransform: getComputedStyle(logo).transform,
        countdownOpacity: countdown ? parseFloat(getComputedStyle(countdown).opacity) : null,
        countdownTransform: countdown ? getComputedStyle(countdown).transform : null,
        countdownText: document.querySelector('.waiting-countdown-value')?.textContent?.trim() ?? null,
        railCenters: { left: center('.waiting-dot-rail-left'), right: center('.waiting-dot-rail-right') },
      };
    })()`));
    if (index < 30) await delay(250);
  }

  await cdp.send("Browser.close");
  cdp.close();

  const renderedCornerWidth = layout.sourceGeometry.cornerRenderedWidth;
  const cornerMetrics = {
    horizontalBranch: 660 / 1105 * renderedCornerWidth,
    verticalBranch: 799 / 1105 * renderedCornerWidth,
    coreThickness: 43 / 1105 * renderedCornerWidth,
    haloBlurRadius: 4,
  };
  const railMetrics = {
    width: layout.railLeft.width,
    length: layout.railLeft.height,
    dotDiameter: railSourceGeometry.dotDiameters[0],
    centerSpacing: railSourceGeometry.dotCentersY[1] - railSourceGeometry.dotCentersY[0],
    terminalDiameter: railSourceGeometry.terminalDiameter,
    crossSpan: railSourceGeometry.crossSpan,
    crossStroke: railSourceGeometry.crossStroke,
    dotOpacity: 0.65,
  };
  const sixAnchors = [
    { element: "sommet haut gauche", target: { x: 96, y: 72 }, measured: layout.cornerAnchors.topLeft },
    { element: "sommet haut droit", target: { x: 1824, y: 72 }, measured: layout.cornerAnchors.topRight },
    { element: "sommet bas gauche", target: { x: 96, y: 1008 }, measured: layout.cornerAnchors.bottomLeft },
    { element: "sommet bas droit", target: { x: 1824, y: 1008 }, measured: layout.cornerAnchors.bottomRight },
    { element: "centre repère droit", target: { x: 1824, y: 324 }, measured: layout.railCenters.right },
    { element: "centre repère gauche", target: { x: 96, y: 702 }, measured: layout.railCenters.left },
  ].map((entry) => ({ ...entry, delta: { x: entry.measured.x - entry.target.x, y: entry.measured.y - entry.target.y } }));
  const sameTransform = (values) => new Set(values).size === 1;
  const messageOpacities = outputSamples.map((sample) => sample.messageOpacity);
  const cornerOpacities = outputSamples.map((sample) => sample.cornerCoreOpacity);
  const stableRailCenters = [...phaseStates, ...outputSamples].every((sample) =>
    samePoint(sample.railCenters.left, TARGET.rails.left) && samePoint(sample.railCenters.right, TARGET.rails.right));
  const matrixAuthorityClearances = phaseStates.map((sample) => ({
    phase: sample.phase,
    topRight: rectanglesDistance(sample.matrices.topRight, TARGET.cornerAuthority.topRight),
    bottomLeft: rectanglesDistance(sample.matrices.bottomLeft, TARGET.cornerAuthority.bottomLeft),
  }));
  const minimumMatrixAuthorityClearance = Math.min(...matrixAuthorityClearances.flatMap((entry) => [entry.topRight, entry.bottomLeft]));
  const baselineMatrixAuthorityClearance = Math.min(
    rectanglesDistance(baseline.layout.matrixTopRight, TARGET.cornerAuthority.topRight),
    rectanglesDistance(baseline.layout.matrixBottomLeft, TARGET.cornerAuthority.bottomLeft),
  );
  const responsivePasses = responsiveMeasurements.every((measurement) =>
    closeTo(measurement.previewScale, measurement.viewport.expectedScale, 0.002) &&
    samePoint(measurement.cornerAnchors.topLeft, { x: 96, y: 72 }) &&
    samePoint(measurement.cornerAnchors.bottomRight, { x: 1824, y: 1008 }) &&
    samePoint(measurement.railCenters.left, TARGET.rails.left) &&
    samePoint(measurement.railCenters.right, TARGET.rails.right));
  const protectedGeometryPasses = ["logo", "messageLayout", "countdown", "ribbonTopLeft", "ribbonRight"]
    .every((key) => protectedRectMatches(layout[key], baseline.layout[key]));
  const assertions = {
    stageIs1920x1080: layout.stage.cssWidth === 1920 && layout.stage.cssHeight === 1080,
    layoutRevisionIsR9: layout.layoutRevision === "les-da-2026-r9",
    frameAnchorsMatchSharedRectangle: sixAnchors.slice(0, 4).every((entry) => samePoint(entry.measured, entry.target, 1)),
    opposingFrameMarginsAreEqual:
      closeTo(layout.cornerAnchors.topLeft.x, TARGET.width - layout.cornerAnchors.topRight.x) &&
      closeTo(layout.cornerAnchors.topLeft.y, TARGET.height - layout.cornerAnchors.bottomLeft.y),
    orientationsMatchVisibleScheme:
      layout.orientations["waiting-frame-corner-top-left"] === "matrix(-1, 0, 0, 1, 0, 0)" &&
      layout.orientations["waiting-frame-corner-top-right"] === "none" &&
      layout.orientations["waiting-frame-corner-bottom-left"] === "matrix(-1, 0, 0, -1, 0, 0)" &&
      layout.orientations["waiting-frame-corner-bottom-right"] === "matrix(1, 0, 0, -1, 0, 0)",
    cornerGeometryWithinRequestedRange:
      cornerMetrics.horizontalBranch >= 52 && cornerMetrics.horizontalBranch <= 68 &&
      cornerMetrics.verticalBranch >= 52 && cornerMetrics.verticalBranch <= 68 &&
      cornerMetrics.coreThickness >= 3 && cornerMetrics.coreThickness <= 4,
    cornerGlowIsControlled:
      layout.cornerStyles.haloFilter === "blur(4px)" &&
      phaseStates.every((sample) => sample.cornerHaloOpacity >= 0.02 && sample.cornerHaloOpacity <= 0.075) &&
      layout.cornerStyles.supportOpacity <= 0.75 && layout.cornerStyles.supportBackground !== "none",
    cornerCoreRemainsAuthoritative:
      phaseStates.every((sample) => sample.cornerCoreOpacity >= 0.855 && sample.cornerCoreOpacity <= 0.965),
    matricesStayOutsideCornerAuthority:
      baselineMatrixAuthorityClearance === 0 && minimumMatrixAuthorityClearance >= TARGET.matrices.minimumAuthorityClearance,
    matricesRemainSecondary:
      closeTo(layout.matrixTopRight.cssWidth, TARGET.matrices.width, 0.1) &&
      closeTo(layout.matrixBottomLeft.cssWidth, TARGET.matrices.width, 0.1) &&
      phaseStates.every((sample) => sample.matrices.topRight.opacity <= 0.205 && sample.matrices.bottomLeft.opacity <= 0.185),
    railsMatchDistinctAnchors: sixAnchors.slice(4).every((entry) => samePoint(entry.measured, entry.target, 1)),
    railAsymmetryIsDeliberate:
      layout.railCenters.right.y < TARGET.height / 2 && layout.railCenters.left.y > TARGET.height / 2 &&
      closeTo(layout.railCenters.left.y - layout.railCenters.right.y, 378) &&
      !closeTo(layout.railCenters.left.y, layout.railCenters.right.y),
    railGeometryMatchesRequestedValues:
      closeTo(railMetrics.length, 200) && closeTo(railMetrics.dotDiameter, 3.5) &&
      closeTo(railMetrics.centerSpacing, 10) && closeTo(railMetrics.terminalDiameter, 8) &&
      closeTo(railMetrics.crossSpan, 14) && closeTo(railMetrics.crossStroke, 2.5),
    railComponentsShareOneAxis:
      closeTo(railSourceGeometry.terminalAxisX, 9) &&
      railSourceGeometry.dotAxesX.every((x) => closeTo(x, 9)) &&
      closeTo(railSourceGeometry.crossAxisX, 9) && railSourceGeometry.crossFitsViewBox,
    railMotifsHaveMatchingBoxes:
      closeTo(layout.railLeft.width, layout.railRight.width) && closeTo(layout.railLeft.height, layout.railRight.height),
    railsAlignedToFrameMargins:
      closeTo(layout.railCenters.left.x, 96) && closeTo(layout.railCenters.right.x, 1824),
    railAndMatrixClearanceAtLeast24:
      rectanglesDistance(layout.railLeft, layout.matrixBottomLeft) >= 24 &&
      rectanglesDistance(layout.railRight, layout.matrixTopRight) >= 24,
    railAndFrameAnchorsRemainStatic: stableRailCenters && phaseStates.every((sample) =>
      samePoint(sample.cornerAnchors.topLeft, { x: 96, y: 72 }) && samePoint(sample.cornerAnchors.bottomRight, { x: 1824, y: 1008 })),
    responsiveScalingPreservesLogicalLayout: responsivePasses,
    guidesArePreviewOnly: guideCount === 1 && outputGuideCount === 0,
    protectedRestGeometryUnchanged: protectedGeometryPasses,
    exactProtectedDecorativeCounts:
      layout.counts.matrices === 2 && layout.counts.rails === 2 && layout.counts.frameCorners === 4 &&
      layout.counts.cornerCores === 4 && layout.counts.cornerHalos === 4,
    noLegacyCentralOrClosedFrame:
      layout.counts.legacyInformationBrackets === 0 && layout.counts.legacyViewportAngles === 0 && layout.counts.legacyFrameLines === 0,
    frozenBreathHitsRequestedExtremes:
      closeTo(phaseStates[0].messageOpacity, 0.94, 0.005) && closeTo(phaseStates[1].messageOpacity, 1, 0.005) &&
      closeTo(phaseStates[2].messageOpacity, 0.94, 0.005) && closeTo(phaseStates[0].cornerCoreOpacity, 0.86, 0.005) &&
      closeTo(phaseStates[1].cornerCoreOpacity, 0.96, 0.005) && closeTo(phaseStates[2].cornerCoreOpacity, 0.86, 0.005),
    frozenCycleReturnsToInitial:
      phaseStates[0].messageTransform === phaseStates[2].messageTransform &&
      closeTo(phaseStates[0].messageOpacity, phaseStates[2].messageOpacity, 0.005) &&
      closeTo(phaseStates[0].cornerCoreOpacity, phaseStates[2].cornerCoreOpacity, 0.005) &&
      phaseStates[0].cornerOrientation === phaseStates[1].cornerOrientation,
    outputBreathRunsAcrossCountdownTicks:
      Math.min(...messageOpacities) <= 0.945 && Math.max(...messageOpacities) >= 0.995 &&
      Math.min(...cornerOpacities) <= 0.87 && Math.max(...cornerOpacities) >= 0.945 &&
      closeTo(outputSamples[0].messageOpacity, outputSamples.at(-1).messageOpacity, 0.03) &&
      closeTo(outputSamples[0].cornerCoreOpacity, outputSamples.at(-1).cornerCoreOpacity, 0.04),
    logoAndCountdownRemainStatic:
      sameTransform(outputSamples.map((sample) => `${sample.logoOpacity}|${sample.logoTransform}`)) &&
      sameTransform(outputSamples.map((sample) => `${sample.countdownOpacity}|${sample.countdownTransform}`)),
  };
  const passed = Object.values(assertions).every(Boolean);

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    previewUrl: PHASE_URL("0"),
    guideUrl: PHASE_URL("0", true),
    outputUrl: OUTPUT_URL,
    target: TARGET,
    sixAnchors,
    layout,
    cornerMetrics,
    railMetrics,
    railSourceGeometry,
    responsiveMeasurements: responsiveMeasurements.map(({ viewport, previewScale, cornerAnchors, railCenters }) => ({ viewport, previewScale, cornerAnchors, railCenters })),
    clearances: {
      leftRailToBottomMatrix: rectanglesDistance(layout.railLeft, layout.matrixBottomLeft),
      rightRailToTopMatrix: rectanglesDistance(layout.railRight, layout.matrixTopRight),
      baselineMatrixToCornerAuthority: baselineMatrixAuthorityClearance,
      minimumMatrixToCornerAuthority: minimumMatrixAuthorityClearance,
      matrixAuthorityByPhase: matrixAuthorityClearances,
    },
    breath: { periodSeconds: 7.5, messageScale: [1, 1.012], messageOpacity: [0.94, 1], cornerCoreOpacity: [0.86, 0.96], cornerHaloOpacity: [0.025, 0.07], phaseStates, outputSamples },
    assertions,
    passed,
  }, null, 2)}\n`);

  if (!passed) process.exitCode = 1;
} finally {
  if (!chrome.killed) chrome.kill();
  await delay(500);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 9) throw error;
      await delay(200);
    }
  }
}
