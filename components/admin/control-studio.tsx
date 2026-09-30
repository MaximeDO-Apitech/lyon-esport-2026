"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCountdownText } from "../graphics/countdown";
import {
  createCommandId,
  postGraphicsCommand,
  useGraphicsFeed,
} from "../graphics/use-graphics-feed";
import { parisWallTimeToUtcMs, utcMsToParisLocalInput } from "../../lib/graphics/time";
import {
  EVENT_TIME_ZONE,
  type GraphicsCommand,
  type LowerThirdContent,
  type OutputId,
  type TimerConfiguration,
  type WaitingContent,
} from "../../lib/graphics/types";

type Drafts = { attente: WaitingContent; synthe: LowerThirdContent };

const emptyDrafts: Drafts = {
  attente: { message: "LE LIVE COMMENCE BIENTÔT", countdownEnabled: true },
  synthe: { name: "", role: "", organization: "" },
};

function sameContent(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function measureOutputText(output: OutputId, content: WaitingContent | LowerThirdContent) {
  await document.fonts.load('900 72px "Eurostile LES"');
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  if (output === "synthe") {
    const value = content as LowerThirdContent;
    context.font = '900 72px "Eurostile LES"';
    if (context.measureText(value.name).width > 850) {
      throw new Error("Le nom est trop long pour le synthé avec la police officielle. Réduis-le avant de prévisualiser.");
    }
  } else {
    const value = content as WaitingContent;
    context.font = '900 82px "Eurostile LES"';
    if (context.measureText(value.message).width > 1480) {
      throw new Error("Le message dépasse la largeur de sécurité de l’attente.");
    }
  }
}

export function ControlStudio() {
  const searchParams = useSearchParams();
  const { envelope, connection, error: connectionError, refresh, getServerNowMs } = useGraphicsFeed(500);
  const [activeOutput, setActiveOutput] = useState<OutputId>("attente");
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [dirty, setDirty] = useState<Record<OutputId, boolean>>({ attente: false, synthe: false });
  const [timerDraft, setTimerDraft] = useState<TimerConfiguration>({
    mode: "duration",
    durationSeconds: 900,
    targetUtcMs: null,
    timeZone: EVENT_TIME_ZONE,
  });
  const [targetLocal, setTargetLocal] = useState("");
  const [commandStatus, setCommandStatus] = useState("Aucune commande envoyée");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const loaded = useRef(false);
  const loadedPreset = useRef("");
  const envelopeRef = useRef(envelope);
  const draftsRef = useRef(drafts);
  const countdown = useCountdownText(envelope?.state ?? null, getServerNowMs);

  useEffect(() => {
    envelopeRef.current = envelope;
  }, [envelope]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!envelope || loaded.current) return;
    const frame = window.requestAnimationFrame(() => {
      setDrafts({
        attente: envelope.state.attente.draft.content,
        synthe: envelope.state.synthe.draft.content,
      });
      setTimerDraft(envelope.state.timer.configuration);
      setTargetLocal(utcMsToParisLocalInput(envelope.state.timer.configuration.targetUtcMs));
      setAdminToken(window.sessionStorage.getItem("les-admin-token") ?? "");
      loaded.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [envelope]);

  useEffect(() => {
    if (!envelope) return;
    const presetId = searchParams.get("preset");
    if (!presetId || loadedPreset.current === presetId) return;
    const preset = envelope.presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    const frame = window.requestAnimationFrame(() => {
      setActiveOutput(preset.family);
      setDrafts((current) => ({ ...current, [preset.family]: preset.content } as Drafts));
      setDirty((current) => ({ ...current, [preset.family]: true }));
      setCommandStatus(`Préréglage chargé en brouillon : ${preset.name}`);
      loadedPreset.current = presetId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [envelope, searchParams]);

  const waitingDraftRevision = envelope?.state.attente.draft.revision ?? 0;
  const lowerThirdDraftRevision = envelope?.state.synthe.draft.revision ?? 0;

  useEffect(() => {
    if (!loaded.current || !envelope) return;
    const frame = window.requestAnimationFrame(() => {
      setDrafts((current) => ({
        attente: dirty.attente ? current.attente : envelope.state.attente.draft.content,
        synthe: dirty.synthe ? current.synthe : envelope.state.synthe.draft.content,
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dirty.attente, dirty.synthe, envelope, lowerThirdDraftRevision, waitingDraftRevision]);

  useEffect(() => {
    if (!loaded.current || connection !== "connected") return;
    const pending = (["attente", "synthe"] as const).filter((output) => dirty[output]);
    if (!pending.length) return;

    const timeout = window.setTimeout(async () => {
      try {
        for (const output of pending) {
          const currentEnvelope = envelopeRef.current;
          if (!currentEnvelope) return;
          const content = draftsRef.current[output];
          const serverDraft = currentEnvelope.state[output].draft;
          if (sameContent(content, serverDraft.content)) {
            setDirty((current) => ({ ...current, [output]: false }));
            continue;
          }
          await postGraphicsCommand({
            id: createCommandId("draft-autosave"),
            type: "draft.update",
            output,
            expectedRevision: serverDraft.revision,
            content,
          });
          if (sameContent(draftsRef.current[output], content)) {
            setDirty((current) => ({ ...current, [output]: false }));
          }
        }
        setCommandStatus("Brouillon synchronisé automatiquement");
        setCommandError(null);
        await refresh();
      } catch (caught) {
        setCommandError(caught instanceof Error ? caught.message : "Synchronisation du brouillon impossible.");
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [connection, dirty, drafts, refresh]);

  const run = useCallback(async (command: GraphicsCommand, success: string) => {
    if (connection !== "connected") {
      setCommandError("Commande non envoyée : le serveur est déconnecté.");
      return null;
    }
    setBusy(true);
    setCommandError(null);
    try {
      const result = await postGraphicsCommand(command);
      setCommandStatus(`${success} · ${new Date().toLocaleTimeString("fr-FR")}`);
      await refresh();
      return result;
    } catch (caught) {
      setCommandError(caught instanceof Error ? caught.message : "Commande refusée.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [connection, refresh]);

  const syncDraft = useCallback(async (output: OutputId) => {
    if (!envelope) return null;
    const serverDraft = envelope.state[output].draft;
    const content = drafts[output];
    if (sameContent(serverDraft.content, content)) return serverDraft.revision;
    await measureOutputText(output, content);
    const result = await run({
      id: createCommandId("draft"),
      type: "draft.update",
      output,
      expectedRevision: serverDraft.revision,
      content,
    }, "Brouillon synchronisé");
    if (!result?.state) return null;
    setDirty((current) => ({ ...current, [output]: false }));
    return result.state[output].draft.revision as number;
  }, [drafts, envelope, run]);

  const preparePreview = useCallback(async () => {
    try {
      const draftRevision = await syncDraft(activeOutput);
      if (draftRevision === null) return;
      const result = await run({
        id: createCommandId("preview"),
        type: "preview.prepare",
        output: activeOutput,
        expectedDraftRevision: draftRevision,
      }, "Prévisualisation préparée");
      if (result) setDirty((current) => ({ ...current, [activeOutput]: false }));
    } catch (caught) {
      setCommandError(caught instanceof Error ? caught.message : "Prévisualisation impossible.");
    }
  }, [activeOutput, run, syncDraft]);

  const publishPreview = useCallback(async () => {
    if (!envelope) return;
    const previewRevision = envelope.state[activeOutput].previewRevision;
    if (!previewRevision) {
      setCommandError("Prépare d’abord une prévisualisation.");
      return;
    }
    await run({
      id: createCommandId("publish"),
      type: "program.publish",
      output: activeOutput,
      expectedPreviewRevision: previewRevision,
    }, `Programme ${activeOutput} publié`);
  }, [activeOutput, envelope, run]);

  const updateDraft = <K extends OutputId>(output: K, content: Drafts[K]) => {
    setDrafts((current) => ({ ...current, [output]: content }));
    setDirty((current) => ({ ...current, [output]: true }));
  };

  const loadPreset = (presetId: string) => {
    const preset = envelope?.presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setActiveOutput(preset.family);
    setDrafts((current) => ({ ...current, [preset.family]: preset.content } as Drafts));
    setDirty((current) => ({ ...current, [preset.family]: true }));
    setCommandStatus(`Préréglage chargé en brouillon : ${preset.name}`);
  };

  const applyTimer = async () => {
    const configuration: TimerConfiguration = timerDraft.mode === "target"
      ? { ...timerDraft, targetUtcMs: parisWallTimeToUtcMs(targetLocal), timeZone: EVENT_TIME_ZONE }
      : { ...timerDraft, targetUtcMs: null, timeZone: EVENT_TIME_ZONE };
    if (configuration.mode === "target" && !Number.isFinite(configuration.targetUtcMs)) {
      setCommandError("Saisis une date et une heure valides pour Europe/Paris.");
      return;
    }
    await run({ id: createCommandId("timer"), type: "timer.configure", configuration }, "Configuration du compteur appliquée");
  };

  const sendSimple = (type: GraphicsCommand["type"], label: string) =>
    run({ id: createCommandId(type), type } as GraphicsCommand, label);

  const copyOutputUrl = async () => {
    const url = `${window.location.origin}/output/${activeOutput}`;
    await navigator.clipboard.writeText(url);
    setCommandStatus(`URL copiée : ${url}`);
  };

  const saveToken = () => {
    if (adminToken.trim()) window.sessionStorage.setItem("les-admin-token", adminToken.trim());
    else window.sessionStorage.removeItem("les-admin-token");
    setCommandStatus("Jeton de commande enregistré pour cette session");
  };

  const activeState = envelope?.state[activeOutput];
  const previewContent = activeState?.preview?.content;
  const hasUnpreviewedChanges = dirty[activeOutput] || !sameContent(drafts[activeOutput], previewContent);
  const programRevision = activeState?.programRevision ?? 0;
  const previewRevision = activeState?.previewRevision ?? 0;
  const rendererAck = envelope?.rendererAcks.find((ack) => ack.output === activeOutput);
  const waitingPreviewUrl = `/preview/attente?simulation=${Math.max(1, timerDraft.durationSeconds)}`;
  const previewUrl = activeOutput === "attente" ? waitingPreviewUrl : "/preview/synthe?background=checker";
  const monitorUrl = activeOutput === "attente"
    ? "/preview/attente?source=program"
    : "/preview/synthe?source=program&background=checker";

  return (
    <main className="studio-page">
      <div className="studio-heading">
        <div>
          <p className="admin-eyebrow">Pupitre graphique · stream</p>
          <h1>Préparer sans toucher au programme</h1>
        </div>
        <div className="output-selector" role="tablist" aria-label="Sortie à piloter">
          <button className={activeOutput === "attente" ? "active" : ""} onClick={() => setActiveOutput("attente")}>Attente</button>
          <button className={activeOutput === "synthe" ? "active" : ""} onClick={() => setActiveOutput("synthe")}>Synthé</button>
        </div>
      </div>

      <div className="studio-grid">
        <aside className="studio-assets admin-panel">
          <div className="panel-title"><span>Bibliothèque rapide</span><small>{envelope?.presets.filter((preset) => preset.family === activeOutput).length ?? 0} préréglages</small></div>
          <div className="preset-stack">
            {envelope?.presets.filter((preset) => preset.family === activeOutput).map((preset) => (
              <button key={preset.id} className="preset-quick" onClick={() => loadPreset(preset.id)}>
                <span>{preset.name}</span>
                <small>{preset.validationStatus === "validated" ? "Validé" : "À valider visuellement"}</small>
              </button>
            ))}
          </div>
          <a className="text-link" href="/admin/library">Gérer toute la bibliothèque →</a>
          <div className="route-card">
            <span>URL vMix stable</span>
            <code>/output/{activeOutput}</code>
            <button type="button" onClick={copyOutputUrl}>Copier l’URL</button>
          </div>
        </aside>

        <section className="studio-viewers">
          <article className="viewer-card viewer-preview">
            <div className="viewer-heading"><span>Prévisualisation</span><small>Révision {previewRevision || "—"}</small></div>
            <div className="viewer-frame"><iframe key={previewUrl} src={previewUrl} title={`Prévisualisation ${activeOutput}`} /></div>
          </article>
          <article className="viewer-card viewer-program">
            <div className="viewer-heading"><span>Moniteur du programme graphique</span><small>Révision {programRevision || "—"}</small></div>
            <div className="viewer-frame"><iframe src={monitorUrl} title={`Moniteur programme ${activeOutput}`} /></div>
            <p className="viewer-disclaimer">État rendu par l’application — ce n’est pas un retour vidéo vMix.</p>
          </article>
        </section>

        <aside className="studio-controls admin-panel">
          <div className="panel-title"><span>Paramètres</span><small>{dirty[activeOutput] ? "Brouillon modifié" : "Brouillon synchronisé"}</small></div>

          {activeOutput === "attente" ? (
            <>
              <label className="admin-field">
                <span>Message</span>
                <input value={drafts.attente.message} maxLength={42} onChange={(event) => updateDraft("attente", { ...drafts.attente, message: event.target.value })} />
              </label>
              <label className="admin-check">
                <input type="checkbox" checked={drafts.attente.countdownEnabled} onChange={(event) => updateDraft("attente", { ...drafts.attente, countdownEnabled: event.target.checked })} />
                <span>Prévoir la zone compteur</span>
              </label>
            </>
          ) : (
            <>
              <label className="admin-field">
                <span>Nom ou pseudonyme</span>
                <input value={drafts.synthe.name} maxLength={36} onChange={(event) => updateDraft("synthe", { ...drafts.synthe, name: event.target.value })} />
              </label>
              <label className="admin-field">
                <span>Fonction <small>optionnelle</small></span>
                <input value={drafts.synthe.role} maxLength={48} onChange={(event) => updateDraft("synthe", { ...drafts.synthe, role: event.target.value })} />
              </label>
              <label className="admin-field">
                <span>Organisation <small>optionnelle</small></span>
                <input value={drafts.synthe.organization} maxLength={48} onChange={(event) => updateDraft("synthe", { ...drafts.synthe, organization: event.target.value })} />
              </label>
            </>
          )}

          <div className="revision-strip">
            <span>Brouillon <b>{activeState?.draft.revision ?? "—"}</b></span>
            <span>Aperçu <b>{previewRevision || "—"}</b></span>
            <span>Programme <b>{programRevision || "—"}</b></span>
          </div>
          {hasUnpreviewedChanges && <p className="pending-warning">Des modifications ne sont pas encore prévisualisées.</p>}

          <div className="primary-commands">
            <button className="admin-button button-preview" disabled={busy} onClick={preparePreview}>Prévisualiser</button>
            <button className="admin-button button-publish" disabled={busy || !previewRevision} onClick={publishPreview}>Publier la prévisualisation</button>
          </div>

          {activeOutput === "synthe" ? (
            <div className="command-section">
              <h2>Affichage synthé</h2>
              <div className="button-row">
                <button disabled={busy} onClick={() => void sendSimple("synthe.show", "Affichage du synthé demandé")}>Afficher</button>
                <button disabled={busy} onClick={() => void sendSimple("synthe.hide", "Masquage du synthé demandé")}>Masquer</button>
              </div>
              <button className="danger-button" disabled={busy} onClick={() => void sendSimple("synthe.clear", "Synthé vidé immédiatement")}>Vider immédiatement</button>
              <p>Publier ne l’affiche jamais automatiquement.</p>
            </div>
          ) : (
            <div className="command-section timer-section">
              <h2>Compteur programme</h2>
              <div className="timer-readout"><b>{countdown.value}</b><span>{envelope?.state.timer.status ?? "—"}</span></div>
              <div className="segmented-control">
                <button className={timerDraft.mode === "duration" ? "active" : ""} onClick={() => setTimerDraft({ ...timerDraft, mode: "duration" })}>Durée</button>
                <button className={timerDraft.mode === "target" ? "active" : ""} onClick={() => setTimerDraft({ ...timerDraft, mode: "target" })}>Heure cible</button>
              </div>
              {timerDraft.mode === "duration" ? (
                <label className="admin-field"><span>Durée en minutes</span><input type="number" min="1" max="10080" value={Math.round(timerDraft.durationSeconds / 60)} onChange={(event) => setTimerDraft({ ...timerDraft, durationSeconds: Math.max(60, Number(event.target.value) * 60) })} /></label>
              ) : (
                <label className="admin-field"><span>Heure cible · Europe/Paris</span><input type="datetime-local" value={targetLocal} onChange={(event) => setTargetLocal(event.target.value)} /></label>
              )}
              <button className="apply-button" disabled={busy} onClick={() => void applyTimer()}>Appliquer cette configuration</button>
              <div className="button-row timer-buttons">
                <button disabled={busy} onClick={() => void sendSimple("timer.start", "Compteur démarré")}>Démarrer</button>
                <button disabled={busy} onClick={() => void sendSimple("timer.pause", "Compteur en pause")}>Pause</button>
                <button disabled={busy} onClick={() => void sendSimple("timer.resume", "Compteur repris")}>Reprendre</button>
                <button disabled={busy} onClick={() => void sendSimple("timer.reset", "Compteur réinitialisé")}>Réinitialiser</button>
              </div>
              <div className="button-row">
                <button disabled={busy} onClick={() => void sendSimple("timer.digits.show", "Chiffres affichés")}>Afficher les chiffres</button>
                <button disabled={busy} onClick={() => void sendSimple("timer.digits.hide", "Chiffres masqués")}>Masquer les chiffres</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="studio-statusbar">
        <StatusItem label="Serveur" value={connection === "connected" ? "Connecté" : connection === "connecting" ? "Connexion…" : "Déconnecté"} tone={connection === "connected" ? "ok" : "error"} />
        <StatusItem label="Dernière commande" value={commandStatus} tone={commandError ? "error" : "neutral"} />
        <StatusItem label="Rendu diffusion" value={rendererAck ? `révision ${rendererAck.revision} appliquée` : "aucun accusé de sortie"} tone={rendererAck?.revision === programRevision ? "ok" : "warn"} />
        <div className="token-control"><input type="password" placeholder="Jeton LAN optionnel" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} /><button onClick={saveToken}>Enregistrer</button></div>
        {(commandError || connectionError) && <p className="status-error">{commandError ?? connectionError}</p>}
      </footer>
    </main>
  );
}

function StatusItem({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "error" | "neutral" }) {
  return <div className={`status-item status-${tone}`}><span>{label}</span><b>{value}</b></div>;
}
