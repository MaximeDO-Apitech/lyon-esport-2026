"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEFAULT_STINGER_VARIANT,
  STINGER_VARIANTS,
  STINGER_VARIANT_LIST,
  type StingerPlaybackStatus,
  type StingerVariantKey,
} from "../../lib/stinger/config";
import { StingerRenderer, type StingerRendererHandle } from "./stinger-renderer";
import styles from "./stinger-preview-client.module.css";

type BackgroundMode = "sources" | "checker" | "light" | "dark" | "contrast";

export function StingerPreviewClient({
  mode = "page",
  browserTest = false,
}: {
  mode?: "page" | "panel";
  browserTest?: boolean;
}) {
  const rendererRef = useRef<StingerRendererHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [variantKey, setVariantKey] = useState<StingerVariantKey>(DEFAULT_STINGER_VARIANT);
  const [status, setStatus] = useState<StingerPlaybackStatus>("loading");
  const [timeMs, setTimeMs] = useState(0);
  const [scale, setScale] = useState(1);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("sources");
  const [notice, setNotice] = useState("Test isolé : aucune commande vMix ou programme n’est envoyée.");
  const [browserReport, setBrowserReport] = useState<{ status: "running" | "pass" | "fail"; value: unknown }>({ status: "running", value: { running: true } });
  const browserTestStartedRef = useRef(false);
  const variant = STINGER_VARIANTS[variantKey];

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!browserTest || status !== "ready" || browserTestStartedRef.current) return;
    browserTestStartedRef.current = true;
    const run = async () => {
      const renderer = rendererRef.current;
      if (!renderer) throw new Error("Renderer d’aperçu indisponible.");
      await renderer.seek(1299);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      const sourceBeforeCut = document.querySelector('[data-testid="stinger-test-source"]')?.textContent;
      await renderer.seek(1300);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      const sourceAtCut = document.querySelector('[data-testid="stinger-test-source"]')?.textContent;
      const variants = [...document.querySelectorAll('[role="group"][aria-label="Variante du stinger"] button')].map((button) => button.textContent?.trim());
      const backgrounds = [...document.querySelectorAll("select option")].map((option) => (option as HTMLOptionElement).value);
      if (sourceBeforeCut !== "A" || sourceAtCut !== "B" || variants.length !== 2 || !backgrounds.includes("contrast")) {
        throw new Error(`Contrôles d’aperçu incorrects : ${JSON.stringify({ sourceBeforeCut, sourceAtCut, variants, backgrounds })}`);
      }
      return { sourceBeforeCut, sourceAtCut, variants, backgrounds, isolatedFromProgram: true };
    };
    void run().then(
      (value) => setBrowserReport({ status: "pass", value }),
      (error) => setBrowserReport({ status: "fail", value: { error: error instanceof Error ? error.message : String(error) } }),
    );
  }, [browserTest, status]);

  const play = useCallback((rate: number) => {
    const accepted = rendererRef.current?.play(rate) ?? false;
    setNotice(accepted
      ? rate === 1
        ? `${variant.label} : lecture A → B lancée à vitesse normale.`
        : `${variant.label} : lecture A → B lancée au ralenti ×0,25.`
      : status === "playing"
        ? "Déclenchement ignoré : le stinger est déjà en lecture."
        : "Stinger indisponible tant que le média n’est pas prêt.");
  }, [status, variant.label]);

  const source = timeMs < variant.cutPointMs ? "A" : "B";
  const marker = (time: number, label: string, cut = false) => (
    <span
      className={`${styles.marker} ${cut ? styles.markerCut : ""}`}
      style={{ left: `${time / variant.durationMs * 100}%` }}
    >
      {label}
    </span>
  );

  return (
    <section className={`${styles.rig} ${mode === "page" ? styles.pageRig : ""}`}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Transition média · test hors programme</p>
          <h2>Stinger principal LES</h2>
          <p>Les deux masters fournis sont lus tels quels. La coupe A → B intervient à 1 300 ms sous une image entièrement opaque ; le damier et les fonds de contrôle ne sont jamais rendus sur la sortie.</p>
        </div>
        <span className={styles.status}>{status}</span>
      </header>

      <div className={styles.variantTabs} role="group" aria-label="Variante du stinger">
        {STINGER_VARIANT_LIST.map((item) => (
          <button
            type="button"
            key={item.key}
            className={variantKey === item.key ? styles.variantActive : ""}
            onClick={() => {
              rendererRef.current?.stop();
              setVariantKey(item.key);
              setTimeMs(0);
              setStatus("loading");
              setNotice(`${item.label} sélectionné. Le changement reste limité à l’aperçu.`);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div ref={viewportRef} className={`${styles.viewport} ${styles[`background_${backgroundMode}`]}`}>
        <div className={styles.canvas} style={{ "--stinger-preview-scale": scale } as CSSProperties}>
          {backgroundMode === "sources" && (
            <div className={`${styles.source} ${source === "A" ? styles.sourceA : styles.sourceB}`}>
              <div className={styles.sourceLabel}><b data-testid="stinger-test-source">{source}</b><span>Source de test</span></div>
            </div>
          )}
          <StingerRenderer
            key={variant.key}
            ref={rendererRef}
            variant={variant}
            onStatusChange={setStatus}
            onTimeChange={setTimeMs}
          />
        </div>
      </div>

      <div className={styles.timeline}>
        {marker(variant.opaqueWindowMs[0], `plein cadre ${Math.round(variant.opaqueWindowMs[0])}`)}
        {marker(variant.cutPointMs, `coupe ${variant.cutPointMs}`, true)}
        {variant.cartoucheWindowMs && marker(variant.cartoucheWindowMs[0], "cartouche")}
        {marker(variant.retractStartMs, `retrait ${Math.round(variant.retractStartMs)}`)}
        <input
          aria-label="Temps du stinger en millisecondes"
          type="range"
          min="0"
          max={variant.durationMs}
          step="1"
          value={Math.min(variant.durationMs, Math.round(timeMs))}
          onChange={(event) => {
            const next = Number(event.target.value);
            void rendererRef.current?.seek(next);
            setTimeMs(next);
            setNotice(`Position déterministe : ${next} ms sur ${variant.label}.`);
          }}
        />
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={() => play(1)}>Tester A → B</button>
        <button type="button" onClick={() => play(0.25)}>Ralenti ×0,25</button>
        <button type="button" onClick={() => void rendererRef.current?.seek(0)}>Retour à 0</button>
        <label className={styles.backgroundControl}>
          <span>Fond de contrôle</span>
          <select value={backgroundMode} onChange={(event) => setBackgroundMode(event.target.value as BackgroundMode)}>
            <option value="sources">Sources A / B</option>
            <option value="checker">Damier alpha</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
            <option value="contrast">Contraste</option>
          </select>
        </label>
        {mode === "panel"
          ? <Link href="/preview/stinger" target="_blank">Ouvrir l’aperçu</Link>
          : <Link href={`/output/stinger?variant=${variant.key}`} target="_blank">Sortie alpha brute</Link>}
        <div className={styles.readout}>
          <b>{Math.round(timeMs)} ms · source {source}</b>
          <span>{variant.frameCount} images · 60 i/s · coupe image 78</span>
        </div>
      </div>

      <dl className={styles.metadata}>
        <div><dt>Variante</dt><dd>{variant.label}</dd></div>
        <div><dt>Format</dt><dd>1920 × 1080 · 60 i/s</dd></div>
        <div><dt>Alpha</dt><dd>Oui · association source préservée · fin transparente</dd></div>
        <div><dt>Audio</dt><dd>Aucun</dd></div>
        <div><dt>Source</dt><dd>{variant.sourceFileName}</dd></div>
        <div><dt>Dérivé web</dt><dd>{variant.mediaPath}</dd></div>
        <div><dt>Diffusion</dt><dd>Séquence PNG RGBA · coupe 1 300 ms</dd></div>
        <div><dt>Statut</dt><dd>À valider visuellement</dd></div>
      </dl>
      <p className={styles.notice}>{notice}</p>
      {browserTest && (
        <pre id="stinger-preview-browser-result" data-status={browserReport.status} className={styles.browserResult}>
          {JSON.stringify(browserReport.value)}
        </pre>
      )}
    </section>
  );
}
