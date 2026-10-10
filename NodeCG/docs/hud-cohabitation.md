# Audit HUD natif, composition et modes

## Reference disponible

Le depot ne contenait pas de capture de spectateur Valorant avec HUD natif. La seule image locale nommee `valorant.jpeg` est une illustration marketing sans interface de jeu. Pour tester le contraste sur une scene de jeu, `graphics/fixtures/reference-gameplay.jpg` reprend sans modification binaire un screengrab officiel du [VALORANT Asset Kit](https://playvalorant.com/en-us/news/game-updates/valorant-asset-kit/). Cette image montre du gameplay mais **pas le HUD spectateur actuel**.

Consequences honnetes :

- minimap, killfeed, score natif, viseur, panneau observe et spike n'ont pas pu etre localises sur une capture evenement recente ;
- le layout peut etre evalue techniquement sur gameplay, mais la recette de cohabitation reste **non faite** ;
- aucun element natif n'est presume masquable ; le mode complet n'est pas valide antenne ;
- une capture autorisee de l'observateur reel, avec ses reglages HUD, est requise avant approbation.

## Grille livree

- canevas logique fixe `1920 × 1080`, centre et reduit uniformement sans recomposition ;
- bandeau score centre en haut, hauteur visible 107 px ;
- rails complets de 302 px de large, a 28 px des bords et a partir de `y = 214` ;
- carte observee de 590 px, centree a 40 px du bas ;
- aucune grande flamme, cadre de viewport, aplat noir de minimap ou killfeed LES ;
- cyan = defense, orange = attaque, avec libelles textuels `DEF`/`ATQ` ;
- vivant/mort/observe restent textuels, jamais portes uniquement par la couleur ;
- ordre des joueurs = ordre Spectra ; noms longs tronques visuellement, DOM et identite conserves ;
- Eurostile Extended Black/Regular et Gotham Black sont des copies binaires des fichiers locaux autorises.

## Modes

**Compact** est la valeur par defaut. Il masque les rails et la carte observee ; les modules peuvent encore etre desactives individuellement. Il minimise le recouvrement mais son bandeau score doit toujours etre confronte au score natif de l'observateur.

**Complet** affiche les rails 5v5 et la carte observee si les donnees sont disponibles. Il est destine a un observateur dont les elements natifs concurrents sont effectivement retires ou compatibles. Sans cette preuve, rester en compact.

## Motion

Les modules utilisent uniquement des transitions d'opacite/translation de 140–160 ms. Scores et etats critiques changent directement ; aucune interpolation numerique, respiration permanente, flamme ou animation historique n'est declenchee. L'arret d'urgence supprime la transition.

## Recette encore requise

1. Capturer l'observateur reel en 1920 × 1080 avec minimap, killfeed, score, spike et panneau observe visibles.
2. Superposer le HUD complet puis compact sur cette capture.
3. Inspecter a 1920 × 1080, 1280 × 720 et 960 × 540 avec DPR consigne.
4. Verifier les phases achat, combat, spike, fin de manche, changement de cote et prolongations.
5. Tester plusieurs temps intermediaires des transitions et la transparence hors modules.
6. Refaire la recette dans le CEF de vMix 29.0.0.49 ; un rendu Chrome seul ne suffit pas.

La skill locale `les-visual-review` a conduit cette separation entre mesure, reference et validation artistique. Le navigateur de test integre n'etait pas disponible pendant ce lot : aucune capture de rendu n'est presentee comme inspectee ni approuvee.
