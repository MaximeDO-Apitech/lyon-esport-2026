# Stinger principal LES — exploitation locale

## Paramètres livrés

- Identifiant : `stinger-principal-les`
- Version : `1.0.0`
- Définition : 1920 × 1080
- Durée de composition : 1 200 ms
- Prototype : 60 images/s — cadence de diffusion à confirmer avec la régie
- Point de coupe proposé : 600 ms, image `0037`
- Fenêtre opaque fonctionnelle demandée : 320 à 800 ms
- Fenêtre opaque mesurée dans l’export 60 i/s : 250 à 800 ms, images `0016` à `0049`
- Audio : aucun
- Rendu de diffusion : séquence PNG RGBA numérotée

La route web sert à la création, à l’aperçu et aux tests. Elle ne synchronise pas la coupe de vMix. En exploitation, charger la séquence PNG dans le mécanisme natif de stinger de vMix.

## Régénérer la livraison

1. Dans un terminal, lancer `npm run dev`.
2. Dans un second terminal, lancer `npm run export:stinger`.
3. Lire `deliverables/stinger-principal-les/v1/manifest.json` et `verification.json`.
4. Le cycle de vie interactif peut être vérifié avec `npm run test:stinger-browser`.

L’export échantillonne la timeline GSAP image par image. Il ne repose pas sur une capture temps réel. La première image correspond à `t = 0`, même si le nom commence à `0001`.

## Import vMix — base documentaire vMix 29

La version installée en régie n’a pas été fournie. La procédure ci-dessous s’appuie donc sur le guide officiel vMix 29 et doit être confirmée sur la machine de diffusion :

- Image Sequence / Stinger : https://www.vmix.com/help29/ImageSequence.html
- Stinger Transitions : https://www.vmix.com/help29/StingerTransitions.html
- Overlays et alpha : https://www.vmix.com/help29/Overlay2.html

1. Ajouter comme entrée `Image Sequence / Stinger` la première image `stinger-principal-les-0001.png`. La numérotation continue permet à vMix de charger la suite automatiquement.
2. Ouvrir les paramètres `Overlay`, choisir `Stinger 1` — ou un emplacement libre — dans `Number`.
3. Régler `Effect` sur `Cut`.
4. Choisir l’entrée de séquence dans `Stinger Input`.
5. Régler `Duration` à 1 200 ms et `Stinger Cut Point` à 600 ms.
6. Choisir explicitement si le stinger doit être affiché sous les overlays actifs. Pour préserver le synthé, tester les deux cas et retenir le comportement de régie voulu, sans modifier le synthé lui-même.
7. Sélectionner `Stinger 1` dans l’un des boutons de transition de la fenêtre principale.
8. Tester A → B sur une mire claire, une mire sombre et une mire fortement contrastée.
9. Vérifier sur la version de vMix et la cadence réellement utilisées que la coupe reste dans la fenêtre opaque mesurée du manifeste.

La documentation vMix recommande l’entrée Image Sequence pour les animations avec alpha complet. Elle indique aussi que le point de coupe doit correspondre au moment où l’animation couvre l’écran. La recette finale reste à effectuer dans vMix ; les tests navigateur ne la remplacent pas.
