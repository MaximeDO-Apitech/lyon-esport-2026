"use client";

import { useEffect, useState } from "react";
import type { ReplayCommand, ReplayMarkerPlacement } from "../../lib/replay/types";
import {
  createReplayCommandId,
  postReplayCommand,
  useReplayFeed,
} from "../graphics/use-replay-feed";
import styles from "./replay-control-panel.module.css";

export function ReplayControlPanel() {
  const { envelope, connection, error: feedError, refresh } = useReplayFeed(500);
  const [draft, setDraft] = useState<ReplayMarkerPlacement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Aucune commande replay envoyée");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!envelope || dirty) return;
    const frame = window.requestAnimationFrame(() => setDraft(envelope.state.draft.placement));
    return () => window.cancelAnimationFrame(frame);
  }, [dirty, envelope]);

  const run = async (command: ReplayCommand, success: string) => {
    if (connection !== "connected") {
      setError("Commande replay non envoyée : serveur déconnecté.");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await postReplayCommand(command);
      setNotice(`${success} · ${new Date().toLocaleTimeString("fr-FR")}`);
      await refresh();
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commande replay refusée.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!envelope || !draft) return;
    const result = await run({
      id: createReplayCommandId("marker-draft"),
      type: "marker.draft.update",
      expectedRevision: envelope.state.draft.revision,
      placement: draft,
    }, "Brouillon du marqueur enregistré");
    if (result) setDirty(false);
    return result;
  };

  const preparePreview = async () => {
    let draftRevision = envelope?.state.draft.revision ?? 0;
    if (dirty) {
      const result = await saveDraft();
      if (!result) return;
      draftRevision = result.state.draft.revision;
    }
    await run({
      id: createReplayCommandId("marker-preview"),
      type: "marker.preview.prepare",
      expectedDraftRevision: draftRevision,
    }, "Prévisualisation du marqueur préparée");
  };

  const publishPreview = async () => {
    if (!envelope) return;
    await run({
      id: createReplayCommandId("marker-publish"),
      type: "marker.program.publish",
      expectedPreviewRevision: envelope.state.previewRevision,
    }, "Position programme du marqueur publiée");
  };

  const markerCommand = (type: "marker.show" | "marker.hide" | "marker.hide.immediate", label: string) =>
    run({ id: createReplayCommandId(type), type }, label);

  const copyUrl = async (path: string) => {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setNotice(`URL copiée : ${url}`);
  };

  const state = envelope?.state;
  const currentDraft = draft ?? state?.draft.placement;

  return (
    <section className={styles.panel}>
      <header>
        <div>
          <p>Pupitre replay · état isolé</p>
          <h2>Marqueur persistant et sorties de transition</h2>
        </div>
        <span className={connection === "connected" ? styles.connected : styles.disconnected}>
          {connection === "connected" ? "Serveur connecté" : "Serveur indisponible"}
        </span>
      </header>

      <div className={styles.grid}>
        <aside className={styles.controls}>
          <h3>Position du marqueur</h3>
          <div className={styles.segmented}>
            <button
              className={currentDraft?.corner === "top-left" ? styles.active : ""}
              onClick={() => { if (currentDraft) { setDraft({ ...currentDraft, corner: "top-left" }); setDirty(true); } }}
            >Haut gauche</button>
            <button
              className={currentDraft?.corner === "top-right" ? styles.active : ""}
              onClick={() => { if (currentDraft) { setDraft({ ...currentDraft, corner: "top-right" }); setDirty(true); } }}
            >Haut droite</button>
          </div>
          <label>
            <span>Décalage horizontal</span>
            <input
              type="number"
              min="48"
              max="480"
              value={currentDraft?.offsetX ?? 96}
              onChange={(event) => {
                if (!currentDraft) return;
                setDraft({ ...currentDraft, offsetX: Number(event.target.value) });
                setDirty(true);
              }}
            />
          </label>
          <label>
            <span>Décalage vertical</span>
            <input
              type="number"
              min="36"
              max="300"
              value={currentDraft?.offsetY ?? 72}
              onChange={(event) => {
                if (!currentDraft) return;
                setDraft({ ...currentDraft, offsetY: Number(event.target.value) });
                setDirty(true);
              }}
            />
          </label>
          <div className={styles.revisions}>
            <span>Brouillon <b>{state?.draft.revision ?? "—"}</b></span>
            <span>Aperçu <b>{state?.previewRevision ?? "—"}</b></span>
            <span>Programme <b>{state?.programRevision ?? "—"}</b></span>
          </div>
          <button disabled={busy || !dirty} onClick={() => void saveDraft()}>Enregistrer le brouillon</button>
          <button disabled={busy} onClick={() => void preparePreview()}>Préparer la prévisualisation</button>
          <button disabled={busy || !state?.previewRevision} onClick={() => void publishPreview()}>Publier la position</button>
        </aside>

        <div className={styles.monitor}>
          <div className={styles.monitorHeading}>
            <span>Moniteur du programme graphique</span>
            <b>{state?.visibility ?? "—"}</b>
          </div>
          <div className={styles.frame}>
            <iframe src="/output/replay-marker?monitor=1" title="Moniteur programme du marqueur replay" />
          </div>
          <p>État rendu par l’application — ce n’est pas un retour vidéo vMix.</p>
        </div>

        <aside className={styles.operations}>
          <h3>Commandes explicites</h3>
          <button className={styles.show} disabled={busy} onClick={() => void markerCommand("marker.show", "Affichage du marqueur demandé")}>Afficher REPLAY</button>
          <button disabled={busy} onClick={() => void markerCommand("marker.hide", "Masquage du marqueur demandé")}>Masquer REPLAY</button>
          <button className={styles.emergency} disabled={busy} onClick={() => void markerCommand("marker.hide.immediate", "Masquage immédiat demandé")}>Masquer immédiatement</button>
          <p>Aucune durée fixe n’est automatisée. L’entrée, le maintien et la sortie restent trois actions de régie indépendantes.</p>
          <div className={styles.routes}>
            <button onClick={() => void copyUrl("/output/replay-in")}>Copier URL entrée</button>
            <button onClick={() => void copyUrl("/output/replay-marker")}>Copier URL marqueur</button>
            <button onClick={() => void copyUrl("/output/replay-out")}>Copier URL sortie</button>
          </div>
        </aside>
      </div>

      <footer>
        <span>Dernière commande : <b>{notice}</b></span>
        <span>Commande graphique appliquée — confirmation source/mixeur non disponible.</span>
        {(error || feedError) && <strong>{error ?? feedError}</strong>}
      </footer>
    </section>
  );
}
