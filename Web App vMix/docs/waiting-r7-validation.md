# Validation technique — attente r7

La révision `les-da-2026-r7` renforce uniquement le cadrage, les deux rails pointillés et la respiration du message de l’attente. Le logo, les rubans de flammes, les matrices de points, la typographie, le compteur et les autres sorties n’ont pas été modifiés.

## Références et ressources

La page unique `DA 2026/éléments source/éléments graphiques/Univers Graphique.pdf` a été rendue et contrôlée visuellement. La zone « ÉLÉMENTS GRAPHIQUES » confirme :

- quatre angles cyan ouverts vers l’intérieur ;
- deux rails verticaux composés d’un point terminal cyan, de points clairs et d’une croix cyan ;
- les matrices de points comme motifs séparés, laissés inchangés dans cette itération.

Les copies publiques de `Angle.png`, `Ligne-points.png` et `Nuage-points.png` sont bit-à-bit identiques aux sources extraites. Le PNG `Angle.png` reste intact. Son orientation native est le coin haut droit : branche vers la gauche et branche vers le bas.

Le PNG officiel des rails ne permet pas d’obtenir simultanément un point de 3 px, un pas de 10 px et une longueur voisine de 200 px : à 200 px de haut, son point opaque ne mesure que 1,93 px. Le dérivé local `public/assets/Ligne-points-renforcee.svg` reproduit donc la structure officielle sans remplacer ni écraser la source. Son empreinte SHA-256 est `C0AE7871BD32863D40F9724E3AB24949A5B3FC2CF00B816C6876FDBFAF3037F8`.

## Valeurs finales

Le cadre intérieur est défini sur le canevas logique 1 920 × 1 080 par les sommets `(96, 72)`, `(1 824, 72)`, `(96, 1 008)` et `(1 824, 1 008)`. Le sommet opaque de la ressource, et non sa boîte transparente, sert de point d’ancrage.

Chaque asset d’angle est rendu à 90 px de large. D’après sa géométrie opaque native, cela produit :

- branche horizontale : 53,76 px ;
- branche verticale : 65,08 px ;
- noyau : 3,50 px ;
- halo séparé : flou fixe de 7 px ;
- opacité du noyau : 0,72 → 0,98.

Chaque rail mesure 18 × 200 px et est centré sur `x = 96` ou `x = 1 824`. Le motif vectoriel utilise des points de 3 px espacés de 10 px centre à centre, un terminal de 8 px, et une croix de 14 px tracée à 2,5 px. Les points blancs `#FAFBFB` sont à 0,65 ; les terminaisons cyan `#01F7FD` sont à 0,86. Les rails restent statiques.

La respiration partage la timeline GSAP existante de 15 secondes : deux cycles complets de 7,5 secondes. Le message passe de `scale(1)` / opacité 0,94 à `scale(1.012)` / opacité 1, puis revient. Les angles suivent la même phase. Le placement et l’orientation des angles restent sur des wrappers statiques séparés ; le logo et le compteur ne sont pas ciblés.

## Vérifications réalisées

`scripts/verify-waiting-layout.mjs` contrôle la prévisualisation figée à `t = 0`, `3,75`, `7,5` et la couture de boucle, puis échantillonne la route `/output/attente` pendant 7,5 secondes. Les douze assertions passent :

- canevas CSS 1 920 × 1 080 ;
- sommets du cadre et orientations `┌ ┐ / └ ┘` exacts ;
- dimensions effectives des branches, du noyau et des rails dans les plages demandées ;
- deux matrices, deux rails et quatre angles seulement ;
- absence des anciens angles centraux et d’un cadre fermé ;
- extrêmes mesurés du message et des angles, avec retour à l’état initial ;
- respiration active sur la route de sortie pendant les ticks du compteur ;
- opacité et transformation du logo et du compteur constantes.

Les preuves dans `captures/waiting-r7/` comprennent :

- `before-after-phase-0.png`, comparaison à cadrage et contenu identiques ;
- `motion-phases.png`, comparaison `t = 0 / T÷2 / T` ;
- `motion-proof-20s.gif`, démonstration 20 secondes à vitesse réelle en 960 × 540 et 2 images/s ;
- `layout-verification.json`, mesures de layout, phases figées et échantillons de sortie ;
- `proof-manifest.json`, dimensions et empreintes des livrables.

Pour rendre la comparaison indépendante de l’état courant du pupitre, le script remplace uniquement le texte et le compteur dans le DOM du navigateur de capture. Il n’appelle aucune commande de publication et ne modifie aucune donnée persistée.

Tests exécutés avec succès : `npm test` (25/25), `npm run lint`, `npx tsc --noEmit` et `npm run build`. Le contrôle navigateur local ne constitue pas une validation broadcast : la cadence, l’alpha, la colorimétrie et le comportement final doivent encore être confirmés dans vMix sur la machine de régie.
