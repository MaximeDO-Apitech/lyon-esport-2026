"use client";

/* eslint-disable @next/next/no-img-element -- the official logo must be served byte-for-byte without image optimization */

import { useEffect, useMemo, useState } from "react";

type TimerMode = "target" | "duration" | "placeholder" | "hidden";

export function ControlPanel() {
  const [mode, setMode] = useState<TimerMode>("target");
  const [target, setTarget] = useState("2026-11-13T19:00");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [origin, setOrigin] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copier l’URL");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOrigin(window.location.origin));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const outputUrl = useMemo(() => {
    if (!origin) return "";
    const url = new URL("/", origin);
    if (mode === "target" && target) url.searchParams.set("target", target);
    if (mode === "duration") url.searchParams.set("duration", String(Math.max(1, Number(durationMinutes) || 1) * 60));
    if (mode === "hidden") url.searchParams.set("countdown", "off");
    return url.toString();
  }, [durationMinutes, mode, origin, target]);

  const copyUrl = async () => {
    if (!outputUrl) return;
    await navigator.clipboard.writeText(outputUrl);
    setCopyLabel("URL copiée");
    window.setTimeout(() => setCopyLabel("Copier l’URL"), 1800);
  };

  return (
    <main className="control-page">
      <header className="control-header">
        <div>
          <p className="control-eyebrow">Lyon e-Sport 2026 · Régie</p>
          <h1>Source navigateur vMix</h1>
          <p>Prépare le compteur, puis ouvre ou copie l’URL de sortie. La page diffusée ne contient aucun contrôle.</p>
        </div>
        <img src="/assets/Bloc_marque_sans-fond_blanc.png" alt="Lyon e-Sport" />
      </header>

      <section className="control-card">
        <h2>Mode du compteur</h2>
        <div className="mode-grid">
          <ModeButton active={mode === "target"} onClick={() => setMode("target")} title="Date et heure" text="Décompte jusqu’à une heure précise." />
          <ModeButton active={mode === "duration"} onClick={() => setMode("duration")} title="Durée" text="Lance un décompte au chargement." />
          <ModeButton active={mode === "placeholder"} onClick={() => setMode("placeholder")} title="Réserve vide" text="Affiche --:--:-- dans la zone." />
          <ModeButton active={mode === "hidden"} onClick={() => setMode("hidden")} title="Masqué" text="Masque entièrement le compteur." />
        </div>

        {mode === "target" && (
          <label className="field">
            <span>Date et heure de début</span>
            <input type="datetime-local" value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
        )}

        {mode === "duration" && (
          <label className="field">
            <span>Durée en minutes</span>
            <input min="1" step="1" type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
          </label>
        )}

        <div className="url-block">
          <span>URL de sortie</span>
          <code>{outputUrl || "Chargement…"}</code>
        </div>

        <div className="control-actions">
          <button className="button button-primary" type="button" onClick={copyUrl}>{copyLabel}</button>
          <a className="button button-secondary" href={outputUrl || "/"} target="_blank" rel="noreferrer">Ouvrir la sortie</a>
        </div>
      </section>

      <section className="vmix-note">
        <strong>Réglages vMix conseillés</strong>
        <span>Source navigateur · 1920 × 1080 · 30 fps · audio désactivé.</span>
      </section>
    </main>
  );
}

function ModeButton({ active, onClick, title, text }: { active: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button className={`mode-button ${active ? "mode-button-active" : ""}`} type="button" onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}
