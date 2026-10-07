# Validation technique et visuelle — attente r9

La révision `les-da-2026-r9` est une passe de finition locale de l’écran « JE REVIENS DANS UN INSTANT ». Elle clarifie la hiérarchie entre les angles, les matrices et les rails sans modifier le logo, les textes, le compteur, les rubans, les routes, l’API ni les autres habillages.

## Diagnostic avant correction

La capture r8 montrait une distance nulle entre les matrices et les zones d’autorité des angles haut droit et bas gauche. Les boîtes se chevauchaient et les pixels lumineux semblaient appartenir au même motif. Le noyau des coins descendait à 0,72 tandis que leur halo montait à 0,28 avec un flou de 7 px : la lueur compensait la faiblesse du trait et élargissait encore la collision.

Les rails étaient déjà correctement construits et asymétriques. Ils n’ont donc pas été déplacés ni redessinés.

## Choix appliqués

### Angles

- sommets visibles inchangés : `(96,72)`, `(1824,72)`, `(96,1008)` et `(1824,1008)` ;
- orientations `┌`, `┐`, `└`, `┘` inchangées ;
- asset officiel et largeur rendue de 90 px inchangés ;
- opacité du noyau resserrée de `0,72–0,98` à `0,86–0,96` ;
- halo réduit de `0,10–0,28` à `0,025–0,07` ;
- rayon de flou réduit de 7 à 4 px ;
- soutien sombre radial local de 136 px derrière chaque sommet, à 0,72, pour détacher le trait des flammes sans renforcer la lueur.

Les coins sont donc plus présents par leur trait et moins par un nuage lumineux. Leur respiration ne modifie ni leur position, ni leur orientation, ni leur géométrie.

### Matrices

- largeur réduite de 126 à 112 px ;
- matrice haute droite déplacée de `right:108 / top:72` à `right:212 / top:96` ;
- matrice basse gauche déplacée de `left:82 / bottom:74` à `left:212 / bottom:96` ;
- dérive réduite de 4 × 3 px à 2,5 × 2 px ;
- opacité haute réduite de `0,26 ± 0,045` à `0,18 ± 0,022` ;
- opacité basse réduite de `0,23 ± 0,04` à `0,16 ± 0,022`.

Chaque angle possède une zone d’autorité intérieure de 92 × 92 px. La distance minimale mesurée entre une matrice animée et sa zone d’autorité passe de 0 px en r8 à 21,62 px en r9 sur les phases contrôlées. Les matrices restent présentes, mais reprennent leur rôle de ponctuation de cinquième niveau.

### Rails

Les centres restent exactement `(1824,324)` à droite et `(96,702)` à gauche. Le motif reste commun : 18 × 200 px, points de 3,5 px espacés de 10 px, terminal de 8 px et croix de 14 px. Les rails restent fixes et secondaires par leur échelle.

## Contrôle réel du rendu

La route `/preview/attente` a été ouverte dans un profil Chrome headless isolé, à DPR 1. Le navigateur intégré n’était pas connecté dans cette session ; le contrôle a donc utilisé l’automatisation Chrome/CDP déjà présente dans le projet.

Contrôles effectués :

- inspection native en 1 920 × 1 080 ;
- réductions uniformes en 1 280 × 720 et 960 × 540 ;
- phases figées à 0 s, 3,75 s, 7,50 s, 11,25 s et à la couture de boucle ;
- échantillonnage en temps réel de `/output/attente` pendant 7,5 s ;
- démonstration animée réelle de 20 s, 40 images à 2 i/s ;
- comparaison directe avec la capture r8 ;
- gros plans des quatre angles et des deux rails ;
- vérification de l’absence des guides sur la sortie programme.

Les six ancrages ont un écart mesuré de 0 px. Le dégagement rail/matrice mesure 107,18 px à droite et 130,78 px à gauche. Les images de début et de couture de boucle ont la même empreinte SHA-256.

## Livrables de preuve

Le dossier `captures/waiting-r9/` contient :

- `before-after-phase-0.png` : comparaison r8/r9 ;
- `detail-inspection.png` : angles HG, HD, BG, BD et rails gauche/droit ;
- `guide-phase-0.png` : cadre, zones d’autorité, matrices et axes des rails ;
- `preview-1280x720.png` et `preview-960x540.png` ;
- `motion-phases.png` ;
- `motion-proof-20s.gif` ;
- `layout-verification.json` et `proof-manifest.json`.

Commandes :

```text
npm run verify:waiting -- --base-url http://localhost:3000
npm run proof:waiting -- --base-url http://localhost:3000
```

Aucune publication n’a été effectuée. Cette recette navigateur valide la géométrie, les pixels inspectés et l’animation web ; elle ne remplace pas l’approbation artistique de l’utilisateur ni le contrôle final d’alpha, de colorimétrie et de cadence dans vMix.
