"use client";

import { useEffect, useState } from "react";
import type {
  OperationsOutputStatus,
  OperationsStatusLevel,
  OperationsStatusReport,
} from "../../lib/operations/types";

function ageLabel(ageMs: number | null) {
  if (ageMs === null) return "jamais";
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  return `il y a ${Math.round(seconds / 60)} min`;
}

function stateLabel(value: string) {
  const labels: Record<string, string> = {
    idle: "prêt",
    running: "en cours",
    paused: "en pause",
    completed: "terminé",
    hidden: "masqué",
    entering: "entrée en cours",
    visible: "visible",
    exiting: "sortie en cours",
  };
  return labels[value] ?? value;
}

function StatusDot({ level }: { level: OperationsStatusLevel }) {
  return <span className={`ops-dot ops-dot-${level}`} aria-hidden="true" />;
}

function OutputCard({ output }: { output: OperationsOutputStatus }) {
  return (
    <article className={`ops-output-card ops-level-${output.level}`}>
      <header>
        <div>
          <span className="ops-status-label"><StatusDot level={output.level} />{output.label}</span>
          <code>{output.path}</code>
        </div>
        <b>{output.level === "ok" ? "Connectée" : output.level === "error" ? "Erreur" : "À vérifier"}</b>
      </header>
      <p>{output.detail}</p>
      <dl>
        <div><dt>Sources actives</dt><dd>{output.connectedRenderers}</dd></div>
        <div><dt>Révision attendue</dt><dd>{output.expectedRevision}</dd></div>
        <div><dt>Révision rendue</dt><dd>{output.appliedRevision ?? "—"}</dd></div>
        <div><dt>Dernier signal</dt><dd>{ageLabel(output.ageMs)}</dd></div>
      </dl>
      <a href={output.path} target="_blank" rel="noreferrer">Ouvrir la sortie</a>
    </article>
  );
}

export function StatusStudio() {
  const [report, setReport] = useState<OperationsStatusReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timeout = 0;

    const load = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        const payload = await response.json() as OperationsStatusReport & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Statut indisponible.");
        if (!active) return;
        setReport(payload);
        setError(null);
        timeout = window.setTimeout(load, payload.refreshAfterMs);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Statut indisponible.");
        timeout = window.setTimeout(load, 5_000);
      }
    };

    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="status-page">
      <div className="status-heading">
        <div>
          <p className="admin-eyebrow">Supervision · canal stream</p>
          <h1>Statut régie</h1>
          <p>Présence des Browser Sources, révisions réellement rendues et état courant du programme.</p>
        </div>
        <div className={`ops-refresh ${error ? "ops-refresh-error" : ""}`} aria-live="polite">
          <span>{error ? "Connexion interrompue" : report ? "Actualisation automatique" : "Connexion…"}</span>
          <b>{report ? new Date(report.generatedAtUtc).toLocaleTimeString("fr-FR") : "—"}</b>
        </div>
      </div>

      {error && <div className="ops-banner ops-banner-error" role="alert">{error}</div>}

      {report && (
        <>
          {report.checks.length === 0 ? (
            <div className="ops-banner ops-banner-ok"><StatusDot level="ok" /><b>Tout est en ordre.</b> Les trois sorties suivies répondent avec la bonne révision.</div>
          ) : (
            <div className={`ops-banner ${report.checks.some((check) => check.level === "error") ? "ops-banner-error" : "ops-banner-warn"}`}>
              <strong>{report.checks.some((check) => check.level === "error") ? "Intervention requise" : "Points à vérifier"}</strong>
              <ul>
                {report.checks.map((check) => (
                  <li key={check.id}><StatusDot level={check.level} /><span><b>{check.label}</b> — {check.detail}</span></li>
                ))}
              </ul>
            </div>
          )}

          <section className="ops-summary" aria-label="État du programme">
            <article><span>Stockage D1</span><b>Opérationnel</b><small>Graphisme r{report.storage.graphicsRevision} · replay r{report.storage.replayRevision}</small></article>
            <article><span>Attente</span><b>{report.program.waitingMessage ?? "Aucun programme"}</b><small>Compteur {stateLabel(report.program.timerStatus)}</small></article>
            <article><span>Synthé</span><b>{stateLabel(report.program.lowerThirdVisibility)}</b><small>État interne du programme</small></article>
            <article><span>Marqueur replay</span><b>{stateLabel(report.program.replayMarkerVisibility)}</b><small>État interne du programme</small></article>
          </section>

          <section className="ops-section">
            <div className="ops-section-heading">
              <div><p className="admin-eyebrow">Contrôle de présence</p><h2>Sorties vMix</h2></div>
              <p>Une source est considérée absente après 15 secondes sans heartbeat.</p>
            </div>
            <div className="ops-output-grid">
              {report.outputs.map((output) => <OutputCard key={output.id} output={output} />)}
            </div>
          </section>

          <section className="ops-section ops-command-section">
            <div className="ops-section-heading">
              <div><p className="admin-eyebrow">Traçabilité légère</p><h2>Dernières commandes</h2></div>
              <p>Historique combiné du graphisme principal et du pack replay.</p>
            </div>
            {report.recentCommands.length ? (
              <div className="ops-command-list">
                {report.recentCommands.map((command) => (
                  <div key={`${command.source}-${command.id}`}>
                    <span className={`ops-source ops-source-${command.source}`}>{command.source === "graphics" ? "Graphisme" : "Replay"}</span>
                    <b>{command.label}</b>
                    <code>{command.id}</code>
                    <time dateTime={command.createdAtUtc}>{new Date(command.createdAtUtc).toLocaleTimeString("fr-FR")}</time>
                  </div>
                ))}
              </div>
            ) : <p className="ops-empty">Aucune commande enregistrée.</p>}
          </section>
        </>
      )}
    </main>
  );
}
