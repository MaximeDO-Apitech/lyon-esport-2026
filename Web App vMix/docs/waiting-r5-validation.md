# Écran d'attente r5 — recomposition et validation

## Périmètre

La révision `les-da-2026-r5` ne modifie que la composition décorative de `les.attente.v1`. Le bloc-marque, le message, le compteur, leurs positions, leurs styles, les routes, les identifiants, les préréglages, la logique de compte à rebours et le programme vMix restent inchangés.

Ressources officielles réemployées sans altération de source :

- `public/assets/Flamme-02.png` : ruban dominant haut-gauche ;
- `public/assets/Flamme-03.png` : volute latérale droite, moitié basse ;
- `public/assets/Angle.png` : un seul jeu de petits repères autour du groupe message-compteur ;
- `public/assets/Nuage-points.png` : deux matrices compactes, haut droit et bas gauche ;
- `public/assets/Ligne-points.png` : deux repères latéraux courts ;
- `public/assets/Elements-01.png` : profondeur de fond.

Les quatre grands angles de viewport, le cadre technique continu et les deux flammes posées sur le bas ont été retirés. Les rubans gardent leur ratio et leur cadrage de source ; seules leur taille uniforme et leur position dans le viewport changent.

## Géométrie de sécurité à 1920 × 1080

Les enveloppes éditoriales existantes sont conservées : logo `x 797–1123 / y 235–495`, message `x 190–1730 / y 560–644` environ, compteur `x 700–1220 / y 724–800`.

- ruban haut-gauche : enveloppe CSS `x -286–694 / y -82–279`, soit au moins 103 px avant le logo dans la zone de recouvrement vertical ;
- volute droite : enveloppe CSS `x 1310–2220 / y 708–1070`, soit 90 px après le compteur horizontalement et 64 px sous le message verticalement avant la déformation locale ;
- la déformation SVG maximale reste locale et sous 13 px, ce qui conserve au moins 48 px de respiration utile ;
- aucun ornement animé ne traverse les enveloppes du logo, du message ou du compteur.

La vérification par Chrome headless relève un aperçu uniformément réduit à `0,912037`. Les distances sont donc normalisées vers le canevas 1920 × 1080 avant comparaison. La marge minimale mesurée est de `63,77 px` entre la volute droite et le message, soit `50,77 px` après une allowance conservatrice de `13 px` pour la déformation. Toutes les assertions sont consignées dans `captures/waiting-r5/layout-verification.json`.

## Boucle et mouvement

La boucle décorative reste déterministe sur 15 secondes. Les rubans ne se déplacent pas globalement : leurs deux cartes de déplacement animent seulement la matière interne. Six particules suivent les deux trajectoires par des oscillations périodiques de 24 à 42 px. Les matrices, rails, halos et atmosphère respirent plus discrètement.

Les captures figées `0`, `0,25`, `0,5` et `0,75` de la boucle ont des empreintes différentes. La capture `0,9999` est volontairement rabattue sur `0` et possède la même empreinte SHA-256, ce qui vérifie la couture de boucle.

## Inventaire des autres plein-écran examinés

Sans modification dans cette livraison :

- `WIP-V4-STREAM-1920-ALED-Compressed.mov` : à reprendre ultérieurement ; une grande volute sert encore de support sur toute la partie basse, malgré un geste haut-gauche déjà cohérent ;
- `STREAM-PROBLEME-TECHNIQUE-V5-1920.mp4` : à reprendre ultérieurement pour la même raison, avec en plus une densité de particules basse plus forte ;
- `Stinger-V1-court-compressed.mov` : non signalé comme anomalie équivalente ; il s'agit d'une transition courte centrée sur le logo, sans lit de flammes persistant en bas. Son cadrage local par angles n'est pas un cadre de viewport.

## Validation opérationnelle

- aperçu de travail : `http://localhost:3000/preview/attente` ;
- phases déterministes : ajouter `?freeze=0`, `?freeze=0.25`, `?freeze=0.5` ou `?freeze=0.75` ;
- sortie vMix inchangée : `http://localhost:3000/output/attente` ;
- aucun passage Program, aucune commande de diffusion et aucune mutation volontaire de l'état de régie n'ont été effectués ;
- le modèle reste `needs_visual_validation` jusqu'à validation artistique et essai manuel dans vMix.

L'absence de navigateur intégré dans la session de production a été contournée uniquement pour les captures par Chrome headless local. Cela ne vaut pas validation vMix.

Contrôles exécutés :

- `npm test` : 20 tests réussis sur 20 ;
- `npm run lint` : réussi ;
- `npm run build` : réussi, routes `/preview/attente` et `/output/attente` présentes ;
- réponses HTTP 200 pour l'aperçu, la sortie, l'administration et `/api/health` ;
- état opérationnel inchangé avant/après, SHA-256 `60F0EEA1976FE356A19B83098284A6FC17D69D70BD92A635694DA8B7EE95A12A` ;
- empreintes des sept ressources officielles identiques aux valeurs enregistrées dans le registre.

Preuves livrées dans `captures/waiting-r5` : comparaison avant/après, quatre phases de boucle, GIF de 20 secondes, manifeste d'empreintes et rapport de géométrie.
