# Lyon e-Sport 2026 — régie graphique

Le dépôt actif est désormais centré sur le produit **Spectra → NodeCG → vMix** :

- [`NodeCG/`](NodeCG/README.md) : connexion unique au serveur Spectra, validation et normalisation des données, Replicants, dashboard et HUD Valorant transparent 1920 × 1080 ;
- [`Web App vMix/`](Web%20App%20vMix/README.md) : sorties historiques encore exploitées — attente, synthé, stingers et pack replay ;
- `Les_Logos/` : sources partenaires locales, volontairement ignorées par Git et hors runtime tant qu'une intégration validée ne les a pas embarquées ;
- [`DOCUMENTATION-EXPLOITATION.md`](DOCUMENTATION-EXPLOITATION.md) : installation, conduite antenne, incidents, sauvegarde et reprise.
- [`VALIDATION-EXPLOITATION-2026-11-04.md`](VALIDATION-EXPLOITATION-2026-11-04.md) : résultat de la recette technique après rangement.

Spectra reste la source métier. NodeCG décide de la présentation du HUD Valorant. vMix compose les graphismes avec la vidéo et reste responsable de la réalisation.

## Vérification rapide

```powershell
cd NodeCG
npm run check

cd "..\Web App vMix"
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Les sources graphiques historiques, anciens ateliers, plans et outils hors runtime sont conservés localement dans `archives/`, volontairement ignoré par Git. Aucun élément de ce dossier ne doit être ajouté aux chemins de production sans réactivation et recette dédiées.
