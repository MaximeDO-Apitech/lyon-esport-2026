"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { STINGER_TIMING, type StingerPlaybackStatus } from "../../lib/stinger/config";
import { StingerRenderer, type StingerRendererHandle } from "./stinger-renderer";
import styles from "./stinger-preview-client.module.css";

export function StingerPreviewClient({ mode = "page" }: { mode?: "page" | "panel" }) {
  const rendererRef = useRef<StingerRendererHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<StingerPlaybackStatus>("loading");
  const [timeMs, setTimeMs] = useState(0);
  const [scale, setScale] = useState(1);
  const [alphaView, setAlphaView] = useState(false);
  const [notice, setNotice] = useState("Test isolé : aucune commande vMix ou programme n’est envoyée.");

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const play = useCallback((rate: number) => {
    const accepted = rendererRef.current?.play(rate) ?? false;
    setNotice(accepted
      ? rate === 1 ? "Lecture A → B lancée à vitesse normale." : "Lecture A → B lancée au ralenti ×0,25."
      : status === "playing" ? "Déclenchement ignoré : le stinger est déjà en lecture." : "Stinger indisponible tant que les ressources ne sont pas prêtes.");
  }, [status]);

  const source = timeMs < STINGER_TIMING.cutPointMs ? "A" : "B";

  return (
    <section className={`${styles.rig} ${mode === "page" ? styles.pageRig : ""}`}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Transition · test hors programme</p>
          <h2>Stinger principal LES</h2>
          <p>Deux sources distinctes basculent à 600 ms sous la couverture opaque. Le damier sert uniquement à contrôler l’alpha de la composition.</p>
        </div>
        <span className={styles.status}>{status}</span>
      </header>

      <div ref={viewportRef} className={`${styles.viewport} ${alphaView ? styles.checker : ""}`}>
        <div className={styles.canvas} style={{ "--stinger-preview-scale": scale } as CSSProperties}>
          {!alphaView && (
            <div className={`${styles.source} ${source === "A" ? styles.sourceA : styles.sourceB}`}>
              <div className={styles.sourceLabel}><b data-testid="stinger-test-source">{source}</b><span>Source de test</span></div>
            </div>
          )}
          <StingerRenderer ref={rendererRef} onStatusChange={setStatus} onTimeChange={setTimeMs} />
        </div>
      </div>

      <div className={styles.timeline}>
        <span className={styles.marker} style={{ left: `${STINGER_TIMING.entryEndMs / STINGER_TIMING.durationMs * 100}%` }}>couverture 320</span>
        <span className={`${styles.marker} ${styles.markerCut}`} style={{ left: `${STINGER_TIMING.cutPointMs / STINGER_TIMING.durationMs * 100}%` }}>coupe 600</span>
        <span className={styles.marker} style={{ left: `${STINGER_TIMING.exitStartMs / STINGER_TIMING.durationMs * 100}%` }}>dégagement 800</span>
        <span className={styles.marker} style={{ left: `${STINGER_TIMING.transparentEndMs / STINGER_TIMING.durationMs * 100}%` }}>transparent 1160</span>
        <input
          aria-label="Temps du stinger en millisecondes"
          type="range"
          min="0"
          max={STINGER_TIMING.durationMs}
          step="1"
          value={Math.round(timeMs)}
          onChange={(event) => {
            const next = Number(event.target.value);
            rendererRef.current?.seek(next);
            setTimeMs(next);
            setNotice(`Position déterministe : ${next} ms.`);
          }}
        />
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={() => play(1)}>Tester A → B</button>
        <button type="button" onClick={() => play(0.25)}>Ralenti ×0,25</button>
        <button type="button" onClick={() => rendererRef.current?.seek(0)}>Retour à 0</button>
        <button type="button" onClick={() => setAlphaView((value) => !value)}>{alphaView ? "Voir A / B" : "Voir l’alpha"}</button>
        {mode === "panel" ? <Link href="/preview/stinger" target="_blank">Ouvrir l’aperçu</Link> : <Link href="/output/stinger" target="_blank">Sortie alpha brute</Link>}
        <div className={styles.readout}><b>{Math.round(timeMs)} ms · source {source}</b><span>60 i/s prototype · cadence diffusion à confirmer</span></div>
      </div>
      <p className={styles.notice}>{notice}</p>
    </section>
  );
}
