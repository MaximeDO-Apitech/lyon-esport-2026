# Validation technique — attente r8

La révision `les-da-2026-r8` corrige localement le cadre et les deux repères pointillés de l’écran d’attente. Les quatre angles appartiennent désormais à un rectangle régulier, tandis que les repères utilisent volontairement deux hauteurs différentes : droit plus haut, gauche plus bas. Le logo, le message, le compteur, les rubans de flammes, les matrices de points et la structure GSAP existante ont été conservés.

## Géométrie finale

Le canevas logique reste fixé à 1 920 × 1 080. Les six ancrages mesurés dans Chromium sont :

| Élément | Cible | Mesure | Écart |
| --- | ---: | ---: | ---: |
| angle haut gauche | `(96, 72)` | `(96, 72)` | `(0, 0)` |
| angle haut droit | `(1 824, 72)` | `(1 824, 72)` | `(0, 0)` |
| angle bas gauche | `(96, 1 008)` | `(96, 1 008)` | `(0, 0)` |
| angle bas droit | `(1 824, 1 008)` | `(1 824, 1 008)` | `(0, 0)` |
| centre du repère droit | `(1 824, 324)` | `(1 824, 324)` | `(0, 0)` |
| centre du repère gauche | `(96, 702)` | `(96, 702)` | `(0, 0)` |

Le cadre mesure donc 1 728 × 936 px, avec des marges opposées identiques de 96 px horizontalement et 72 px verticalement. L’écart vertical volontaire entre les centres des rails est de 378 px.

Chaque angle conserve l’asset PNG officiel rendu à 90 px de large. Sa géométrie opaque produit une branche horizontale de 53,76 px, une branche verticale de 65,08 px et un noyau de 3,50 px. Les orientations visibles sont `┌`, `┐`, `└`, `┘` et seul le noyau/halo change d’opacité.

Les deux rails utilisent exactement le même SVG local de 18 × 200 px : terminal de 8 px tangent au bord supérieur, seize points de 3,5 px espacés de 10 px centre à centre, puis croix de 14 px tracée à 2,5 px et contenue dans le bord inférieur. Tous les éléments du motif partagent l’axe interne `x = 9`. Le rail gauche conserve 86,00 px de dégagement avec la matrice basse ; le rail droit 33,58 px avec la matrice haute.

## Respiration et stabilité

La timeline GSAP existante dure toujours 15 secondes et contient deux respirations de 7,5 secondes. Le message varie de `scale(1)` / opacité 0,94 à `scale(1.012)` / opacité 1, puis revient. Les noyaux d’angle passent de 0,72 à 0,98 et leurs halos de 0,10 à 0,28.

Les positions des quatre angles et des deux rails restent identiques aux phases 0, 0,25, 0,5 et 0,9999. Un échantillonnage réel de `/output/attente` sur un cycle confirme que le logo et le compteur gardent leur transformation et leur opacité, tandis que les repères pointillés ne bougent pas. Les images de début et de couture de boucle ont la même empreinte.

## Contrôle multi-format et guides

Les mesures navigateur ont été réalisées à DPR 1 en 1 920 × 1 080, 1 280 × 720 et 960 × 540. Après normalisation par le facteur d’échelle, les six ancrages retrouvent les mêmes coordonnées logiques dans les trois formats.

Les guides sont disponibles uniquement sur la route de prévisualisation :

`/preview/attente?freeze=0&guides=1`

Ils affichent le rectangle régulier des angles, la médiane `y = 540`, les boîtes 18 × 200 px, leurs axes et leurs centres. La route `/output/attente` ne peut pas les afficher.

## Preuves et commandes

Le dossier `captures/waiting-r8/` contient :

- `before-after-phase-0.png` : comparaison avec la révision r7 ;
- `guide-phase-0.png` : contrôle du rectangle, de la médiane et des six ancrages ;
- `detail-inspection.png` : gros plans des quatre angles et des deux rails ;
- `preview-1280x720.png` et `preview-960x540.png` : lisibilité réduite ;
- `motion-phases.png` : phases 0 s, 3,75 s et 7,50 s ;
- `motion-proof-20s.gif` : démonstration animée réelle de 20 secondes, 40 images en 960 × 540 ;
- `layout-verification.json` : mesures et assertions navigateur ;
- `proof-manifest.json` : dimensions et empreintes SHA-256 des livrables.

Commandes de reproduction :

```text
npm run verify:waiting -- --base-url http://localhost:3000
npm run proof:waiting -- --base-url http://localhost:3000
```

Le contrôle automatisé valide le cadre régulier, les deux ancrages asymétriques, la construction interne commune des rails, les dégagements avec les matrices, la stabilité des positions pendant l’animation, la respiration de la sortie réelle, l’absence de guides en programme et la conservation des autres éléments protégés.

La pièce jointe accessible dans cette session contenait le brief textuel et les coordonnées, mais pas un bitmap distinct de la nouvelle référence visuelle. La comparaison visuelle a donc été menée contre la capture r7 existante et les contraintes chiffrées explicites du brief.

Aucune publication n’a été effectuée. Cette recette navigateur ne remplace pas le contrôle final dans vMix pour l’alpha, la cadence, la colorimétrie et le rendu sur la machine de régie.
