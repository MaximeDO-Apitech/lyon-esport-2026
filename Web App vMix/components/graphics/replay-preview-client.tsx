"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { REPLAY_TRANSITIONS } from "../../lib/replay/config";
import { DEFAULT_REPLAY_MARKER_PLACEMENT } from "../../lib/replay/state";
import {
  ReplayTransitionRenderer,
  type ReplayTransitionRendererHandle,
} from "./replay-transition-renderer";
import { ReplayMarkerGraphic } from "./replay-marker-renderer";
import styles from "./replay-preview-client.module.css";

const CYCLE_MS = 8000;
const ENTRY_CUT_MS = 400;
const ANGLE_CHANGE_MS = 3400;
const EXIT_START_MS = 6800;
const EXIT_CUT_MS = EXIT_START_MS + 300;
const MARKER_IN_MS = 200;
const MARKER_OUT_MS = 6950;

function sourceAt(timeMs: number) {
  if (timeMs < ENTRY_CUT_MS) return "A";
  if (timeMs < ANGLE_CHANGE_MS) return "B";
  if (timeMs < EXIT_CUT_MS) return "C";
  return "A";
}

export function ReplayPreviewClient({ mode = "page" }: { mode?: "page" | "panel" }) {
  const inRef = useRef<ReplayTransitionRendererHandle>(null);
  const outRef = useRef<ReplayTransitionRendererHandle>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [inReady, setInReady] = useState(false);
  const [outReady, setOutReady] = useState(false);
  const source = sourceAt(timeMs);
  const markerVisible = timeMs >= MARKER_IN_MS && timeMs < MARKER_OUT_MS;

  useEffect(() => {
    inRef.current?.seek(Math.min(REPLAY_TRANSITIONS.in.durationMs, Math.max(0, timeMs)));
    outRef.current?.seek(Math.min(REPLAY_TRANSITIONS.out.durationMs, Math.max(0, timeMs - EXIT_START_MS)));
  }, [inReady, outReady, timeMs]);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      setTimeMs((current) => {
        const next = current + delta * rate;
        return next >= CYCLE_MS ? next % CYCLE_MS : next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate]);

  const phase = useMemo(() => {
    if (timeMs < ENTRY_CUT_MS) return "Entrée · source A";
    if (timeMs < REPLAY_TRANSITIONS.in.durationMs) return "Entrée · replay B";
    if (timeMs < ANGLE_CHANGE_MS) return "Replay B";
    if (timeMs < EXIT_START_MS) return "Replay C · changement d’angle";
    if (timeMs < EXIT_CUT_MS) return "Sortie · replay C";
    if (timeMs < EXIT_START_MS + REPLAY_TRANSITIONS.out.durationMs) return "Sortie · source A";
    return "Source A";
  }, [timeMs]);

  const startNormal = () => {
    setRate(1);
    setTimeMs(0);
    setPlaying(true);
  };
  const startSlow = () => {
    setRate(0.25);
    setTimeMs(0);
    setPlaying(true);
  };
  const earlyExit = () => {
    setTimeMs(EXIT_START_MS);
    setPlaying(true);
  };

  return (
    <section className={`${styles.rig} ${mode === "panel" ? styles.panelMode : ""}`}>
      <header className={styles.heading}>
        <div>
          <p>Banc de test replay · aucun ordre programme</p>
          <h2>Chaîne A → entrée → B → C → sortie → A</h2>
        </div>
        <a href="/preview/replay" target="_blank">Ouvrir en plein écran</a>
      </header>

      <div className={styles.testGrid}>
        <div className={styles.viewer}>
          <div className={styles.viewport}>
            <div className={styles.logical}>
              <div className={`${styles.source} ${styles[`source${source}`]}`} data-source={source}>
                <span>SOURCE {source}</span>
                <i />
                <b>{source === "A" ? "DIRECT" : source === "B" ? "REPLAY · PLAN LARGE" : "REPLAY · ANGLE 2"}</b>
              </div>
              {markerVisible && <ReplayMarkerGraphic placement={DEFAULT_REPLAY_MARKER_PLACEMENT} />}
              <div className={styles.transitionLayer} style={{ opacity: timeMs <= REPLAY_TRANSITIONS.in.durationMs ? 1 : 0 }}>
                <ReplayTransitionRenderer
                  ref={inRef}
                  kind="in"
                  onStatusChange={(status) => setInReady(status === "ready" || status === "playing")}
                />
              </div>
              <div className={styles.transitionLayer} style={{ opacity: timeMs >= EXIT_START_MS && timeMs <= EXIT_START_MS + REPLAY_TRANSITIONS.out.durationMs ? 1 : 0 }}>
                <ReplayTransitionRenderer
                  ref={outRef}
                  kind="out"
                  onStatusChange={(status) => setOutReady(status === "ready" || status === "playing")}
                />
              </div>
            </div>
          </div>

          <div className={styles.transport}>
            <div className={styles.timeRow}>
              <strong>{phase}</strong>
              <code>{Math.round(timeMs)} / {CYCLE_MS} ms</code>
            </div>
            <input
              aria-label="Position dans le scénario replay"
              type="range"
              min="0"
              max={CYCLE_MS}
              step="1"
              value={Math.round(timeMs)}
              onChange={(event) => {
                setPlaying(false);
                setTimeMs(Number(event.target.value));
              }}
            />
            <div className={styles.buttons}>
              <button onClick={startNormal}>Lecture normale</button>
              <button onClick={startSlow}>Ralenti 0,25×</button>
              <button onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Reprendre"}</button>
              <button onClick={earlyExit}>Sortie anticipée</button>
              <button onClick={() => { setPlaying(false); setTimeMs(0); }}>Réinitialiser</button>
            </div>
            <div className={styles.cuts}>
              <span>Coupe entrée <b>400 ms</b></span>
              <span>B → C <b>3 400 ms</b></span>
              <span>Coupe sortie <b>7 100 ms</b></span>
              <span>Marqueur stable <b>B + C</b></span>
            </div>
          </div>
        </div>

        <aside className={styles.proofs}>
          <h3>Preuves de lisibilité du marqueur</h3>
          {[
            ["light", "Fond clair"],
            ["dark", "Fond sombre"],
            ["moving", "Fond animé"],
            ["checker", "Transparence"],
          ].map(([kind, label]) => (
            <figure className={`${styles.proof} ${styles[`proof${kind}`]}`} key={kind}>
              <div className={styles.proofLogical}>
                <ReplayMarkerGraphic placement={DEFAULT_REPLAY_MARKER_PLACEMENT} />
              </div>
              <figcaption>{label}</figcaption>
            </figure>
          ))}
          <p>Ces vues restent locales au banc de test. Les commandes d’affichage programme sont exclusivement dans le pupitre replay.</p>
        </aside>
      </div>
    </section>
  );
}
