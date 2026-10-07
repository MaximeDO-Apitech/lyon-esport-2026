"use client";

/* eslint-disable @next/next/no-img-element -- fixed local thumbnails and official assets are not optimized */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STINGER_LIBRARY_ASSET } from "../../lib/stinger/config";
import { REPLAY_LIBRARY_ASSET } from "../../lib/replay/config";
import type { GraphicsCommand, PresetExport, TemplateFamily, ValidationStatus } from "../../lib/graphics/types";
import { createCommandId, postGraphicsCommand, useGraphicsFeed } from "../graphics/use-graphics-feed";

const statusLabels: Record<ValidationStatus, string> = {
  missing_resources: "Ressources manquantes",
  needs_visual_validation: "À valider visuellement",
  validated: "Validé",
};

export function LibraryStudio() {
  const { envelope, connection, refresh } = useGraphicsFeed(900);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<TemplateFamily | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [notice, setNotice] = useState("Bibliothèque prête");
  const [error, setError] = useState<string | null>(null);
  const selected = envelope?.presets.find((preset) => preset.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && envelope?.presets[0]) {
      const frame = window.requestAnimationFrame(() => {
        setSelectedId(envelope.presets[0].id);
        setPresetName(envelope.presets[0].name);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [envelope, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const frame = window.requestAnimationFrame(() => setPresetName(selected.name));
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const filteredPresets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr-FR");
    return (envelope?.presets ?? []).filter((preset) => {
      const matchesFamily = family === "all" || preset.family === family;
      const matchesQuery = !normalized || `${preset.name} ${preset.templateId}`.toLocaleLowerCase("fr-FR").includes(normalized);
      return matchesFamily && matchesQuery;
    });
  }, [envelope, family, query]);

  const send = async (command: GraphicsCommand, success: string) => {
    setError(null);
    try {
      const result = await postGraphicsCommand(command);
      setNotice(success);
      await refresh();
      if (result.preset?.id) setSelectedId(result.preset.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opération refusée.");
    }
  };

  const saveCurrentDraft = async () => {
    const output = family === "all" ? selected?.family ?? "attente" : family;
    await send({ id: createCommandId("preset"), type: "preset.save", output, name: presetName }, "Brouillon enregistré comme préréglage");
  };

  const duplicateSelected = async () => {
    if (!selected) return;
    await send({ id: createCommandId("preset"), type: "preset.duplicate", presetId: selected.id, name: presetName }, "Préréglage dupliqué");
  };

  const renameSelected = async () => {
    if (!selected) return;
    await send({ id: createCommandId("preset"), type: "preset.rename", presetId: selected.id, name: presetName }, "Préréglage renommé");
  };

  const exportSelected = () => {
    if (!selected) return;
    const payload: PresetExport = {
      schemaVersion: 1,
      templateId: selected.templateId,
      templateVersion: selected.templateVersion,
      name: selected.name,
      content: selected.content,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.name.toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, "-") || "preset"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Export JSON créé");
  };

  const importPreset = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PresetExport;
      await send({ id: createCommandId("preset"), type: "preset.import", preset: parsed }, "Préréglage importé et validé");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fichier JSON invalide.");
    }
  };

  const copyOutputUrl = async (output: TemplateFamily) => {
    const url = `${window.location.origin}/output/${output}`;
    await navigator.clipboard.writeText(url);
    setNotice(`URL copiée : ${url}`);
  };

  return (
    <main className="library-page">
      <header className="library-heading">
        <div>
          <p className="admin-eyebrow">Registre extensible</p>
          <h1>Bibliothèque graphique</h1>
          <p>Modèles, ressources et préréglages du canal stream. Les miniatures sont fixes et n’exécutent aucune animation.</p>
        </div>
        <span className={`connection-pill ${connection}`}>{connection === "connected" ? "Serveur connecté" : "Serveur indisponible"}</span>
      </header>

      <section className="template-grid">
        {envelope?.templates.map((template) => (
          <article className="template-card" key={template.id}>
            <div className={`template-thumb template-thumb-${template.family}`}>
              <img src={template.thumbnail} alt={`Miniature réelle du modèle ${template.name}`} />
              {template.transparent && <span>Alpha</span>}
            </div>
            <div className="template-body">
              <div className="template-title"><h2>{template.name}</h2><StatusBadge status={template.validationStatus} /></div>
              <p>{template.description}</p>
              <dl><div><dt>Identifiant</dt><dd>{template.id}</dd></div><div><dt>Version</dt><dd>{template.version}</dd></div><div><dt>Format</dt><dd>{template.width} × {template.height}</dd></div></dl>
              <div className="resource-list">
                {template.resources.map((resource) => (
                  <span className={resource.status === "missing" ? "resource-missing" : "resource-ok"} key={resource.id}>
                    {resource.label}<b>{resource.status === "missing" ? "Manquante" : "Disponible"}</b>
                  </span>
                ))}
              </div>
              <button onClick={() => void copyOutputUrl(template.family)}>Copier l’URL de sortie</button>
            </div>
          </article>
        ))}
        <StingerLibraryCard onNotice={setNotice} />
        <ReplayLibraryCard onNotice={setNotice} />
      </section>

      <section className="preset-library admin-panel">
        <div className="library-toolbar">
          <label><span>Rechercher</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom ou identifiant…" /></label>
          <div className="filter-buttons" role="group" aria-label="Filtrer par famille">
            <button className={family === "all" ? "active" : ""} onClick={() => setFamily("all")}>Tous</button>
            <button className={family === "attente" ? "active" : ""} onClick={() => setFamily("attente")}>Attente</button>
            <button className={family === "synthe" ? "active" : ""} onClick={() => setFamily("synthe")}>Synthé</button>
          </div>
          <label className="import-button">Importer JSON<input type="file" accept="application/json,.json" onChange={(event) => void importPreset(event.target.files?.[0])} /></label>
        </div>

        <div className="preset-library-grid">
          <div className="preset-table" role="listbox" aria-label="Préréglages">
            {filteredPresets.map((preset) => (
              <button className={preset.id === selectedId ? "selected" : ""} key={preset.id} onClick={() => setSelectedId(preset.id)}>
                <span><b>{preset.name}</b><small>{preset.family} · {preset.templateVersion}</small></span>
                <StatusBadge status={preset.validationStatus} />
              </button>
            ))}
            {!filteredPresets.length && <p>Aucun préréglage ne correspond au filtre.</p>}
          </div>

          <div className="preset-editor">
            <h2>{selected ? "Préréglage sélectionné" : "Nouveau préréglage"}</h2>
            {selected && <pre>{JSON.stringify(selected.content, null, 2)}</pre>}
            <label className="admin-field"><span>Nom du préréglage</span><input value={presetName} maxLength={64} onChange={(event) => setPresetName(event.target.value)} /></label>
            <div className="preset-actions">
              <button onClick={() => void saveCurrentDraft()}>Sauvegarder le brouillon courant</button>
              <button disabled={!selected} onClick={() => void duplicateSelected()}>Dupliquer</button>
              <button disabled={!selected || selected.locked} onClick={() => void renameSelected()}>Renommer</button>
              <button disabled={!selected} onClick={exportSelected}>Exporter JSON</button>
              {selected && <Link href={`/admin/control?preset=${encodeURIComponent(selected.id)}`}>Charger dans le pupitre</Link>}
            </div>
            <p className="library-notice">{error ? <span className="error-text">{error}</span> : notice}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function StingerLibraryCard({ onNotice }: { onNotice: (notice: string) => void }) {
  const asset = STINGER_LIBRARY_ASSET;
  const copyExportCommand = async () => {
    await navigator.clipboard.writeText(asset.exportCommand);
    onNotice(`Commande copiée : ${asset.exportCommand}`);
  };

  return (
    <article className="template-card" data-template-id={asset.id}>
      <div className="template-thumb template-thumb-transitions stinger-variant-thumbs">
        {asset.variants.map((variant) => (
          <figure key={variant.key}>
            <img src={variant.thumbnail} alt={`Image réelle du stinger LES ${variant.label}`} />
            <figcaption>{variant.label}</figcaption>
          </figure>
        ))}
        <span>Alpha</span>
      </div>
      <div className="template-body">
        <div className="template-title"><h2>{asset.name}</h2><StatusBadge status={asset.validationStatus} /></div>
        <p>{asset.description}</p>
        <dl>
          <div><dt>Famille</dt><dd>{asset.family}</dd></div>
          <div><dt>Identifiant</dt><dd>{asset.id}</dd></div>
          <div><dt>Version</dt><dd>{asset.version}</dd></div>
          <div><dt>Format</dt><dd>{asset.width} × {asset.height}</dd></div>
          <div><dt>Variantes</dt><dd>2 000 ms · 5 000 ms</dd></div>
          <div><dt>Cadence</dt><dd>{asset.cadenceNote}</dd></div>
          <div><dt>Coupe</dt><dd>{asset.cutPointMs} ms</dd></div>
          <div><dt>Alpha</dt><dd>Association source préservée · fin transparente</dd></div>
          <div><dt>Audio</dt><dd>Aucun</dd></div>
        </dl>
        <div className="resource-list">
          {asset.variants.map((variant) => (
            <span className="resource-ok" key={variant.key}>
              {variant.label}
              <b>{variant.frameCount} images · source et dérivés disponibles</b>
            </span>
          ))}
        </div>
        <div className="preset-actions">
          <Link href={asset.previewPath} target="_blank">Prévisualiser</Link>
          <Link href={`${asset.outputPath}?variant=short`} target="_blank">Sortie courte</Link>
          <Link href={`${asset.outputPath}?variant=long`} target="_blank">Sortie longue</Link>
          <button type="button" onClick={() => void copyExportCommand()}>Copier la commande d’export</button>
        </div>
      </div>
    </article>
  );
}
function ReplayLibraryCard({ onNotice }: { onNotice: (notice: string) => void }) {
  const asset = REPLAY_LIBRARY_ASSET;
  const copyExportCommand = async () => {
    await navigator.clipboard.writeText(asset.exportCommand);
    onNotice(`Commande copiée : ${asset.exportCommand}`);
  };

  return (
    <article className="template-card" data-template-id={asset.id}>
      <div className="template-thumb template-thumb-transitions">
        <img src={asset.components[0].thumbnail} alt="Miniature de l’entrée du pack replay LES" />
        <span>Alpha</span>
      </div>
      <div className="template-body">
        <div className="template-title"><h2>{asset.name}</h2><StatusBadge status={asset.validationStatus} /></div>
        <p>{asset.description}</p>
        <dl>
          <div><dt>Famille</dt><dd>{asset.family}</dd></div>
          <div><dt>Identifiant</dt><dd>{asset.id}</dd></div>
          <div><dt>Version</dt><dd>{asset.version}</dd></div>
          <div><dt>Format</dt><dd>{asset.width} × {asset.height}</dd></div>
          <div><dt>Cadence</dt><dd>{asset.cadenceNote}</dd></div>
          <div><dt>Audio</dt><dd>Aucun</dd></div>
        </dl>
        <div className="resource-list">
          {asset.components.map((component) => (
            <span className="resource-ok" key={component.id}>
              {component.label}
              <b>{component.durationMs === null ? "Persistant" : `${component.durationMs} ms · coupe ${component.cutPointMs} ms`}</b>
            </span>
          ))}
        </div>
        <div className="preset-actions">
          <Link href={asset.previewPath} target="_blank">Ouvrir le banc de test</Link>
          <Link href={asset.components[1].outputPath} target="_blank">Sortie marqueur</Link>
          <button type="button" onClick={() => void copyExportCommand()}>Copier la commande d’export</button>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ValidationStatus }) {
  return <span className={`validation-badge validation-${status}`}>{statusLabels[status]}</span>;
}
