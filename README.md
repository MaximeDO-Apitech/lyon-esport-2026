# lyon-esport-2026

La procédure complète de mise en service, conduite antenne, dépannage, sauvegarde et arrêt est disponible dans [`DOCUMENTATION-EXPLOITATION.md`](DOCUMENTATION-EXPLOITATION.md).

## NodeCG / Valorant

Le nouveau bundle [`NodeCG/`](NodeCG/README.md) consomme la sortie officielle du serveur Spectra dans une extension unique, normalise les donnees dans des Replicants et sert un HUD LES transparent 1920 × 1080 pour vMix. Spectra reste la source metier ; NodeCG gere la presentation ; la video reste une entree vMix separee. La migration est additive : les sorties validees de `Web App vMix` ne sont ni deplacees ni modifiees dans ce lot.

## OpenMontage

[OpenMontage](https://github.com/calesthio/OpenMontage) est intégré comme sous-module dans `tools/OpenMontage`. Cette séparation conserve son historique et sa licence AGPL-3.0 sans mélanger ses dépendances Python/Remotion avec `Web App vMix`.

Après un nouveau clone du projet :

```powershell
git submodule update --init --recursive
py -3.11 -m venv tools/OpenMontage/.venv
tools/OpenMontage/.venv/Scripts/python.exe -m pip install -r tools/OpenMontage/requirements.txt
tools/OpenMontage/.venv/Scripts/python.exe -m pip install piper-tts
npm ci --prefix tools/OpenMontage/remotion-composer
```

Sur cette machine, FFmpeg 9.0.2, Python 3.11, Piper, Remotion 4.0.484 et HyperFrames 0.8.140 sont installés. Le modèle vocal local par défaut `en_US-lessac-medium` est présent. Les clés de fournisseurs restent optionnelles et doivent être placées uniquement dans `tools/OpenMontage/.env`, qui est ignoré par Git.

Commandes utiles depuis la racine :

```powershell
.\openmontage.ps1 preflight
.\openmontage.ps1 doctor
.\openmontage.ps1 backlot
.\openmontage.ps1 demo-list
```

Les productions OpenMontage sont créées dans `tools/OpenMontage/projects/`, également ignoré par Git. Avant toute production, suivre le contrat décrit dans `tools/OpenMontage/AGENT_GUIDE.md` : sélection de pipeline, préflight, proposition et points d’approbation.

L’intégration propre au projet LES, son profil de marque, sa politique locale à
0 USD et le pilote de qualification des deux stingers sont documentés dans
[`production/openmontage-les/`](production/openmontage-les/README.md). Ce chemin
reste un atelier hors programme : il ne publie ni ne sélectionne aucun asset
dans la régie.
