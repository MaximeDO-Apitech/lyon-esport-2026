# Stinger principal LES V2 — exploitation locale et vMix

## Livraison

Le stinger principal utilise désormais exactement les deux vidéos fournies. L’ancien prototype GSAP n’est plus le rendu actif ; sa livraison V1 reste conservée dans `deliverables/stinger-principal-les/v1/`.

| Variante | Durée | Images | Plein cadre sécurisé | Coupe proposée | Fin |
| --- | ---: | ---: | --- | --- | --- |
| Court — 2 s | 2 000 ms | 120 | images 64 à 99 incluses | 1 300 ms, index 78, fichier `0079` | image 119 transparente |
| Long — 5 s | 5 000 ms | 300 | images 64 à 281 incluses | 1 300 ms, index 78, fichier `0079` | image 299 forcée transparente |

Les deux variantes sont en 1920 × 1080, 60 images/s et sans audio. La version longue conserve son cartouche partenaires, dont CGI, visible approximativement entre 2,15 et 4,30 secondes. Elle n’est donc pas un simple ralenti de la version courte.

Le statut reste `needs_visual_validation`. Les contrôles automatiques certifient la structure, les temps, l’alpha et l’intégrité des fichiers ; ils ne constituent pas une validation artistique.

## Masters protégés

Les originaux restent distincts des dérivés et ont été placés en lecture seule :

| Fichier | SHA-256 |
| --- | --- |
| `Stinger-V2-court-compressed.mov` | `148513D14E94751BEC2077281CA584A9B3824A17A812D6A3658F90264998CC54` |
| `Stinger-V2-Long-compressed.mov` | `F5EA1ACF0140C4FF9DDAB069997A4390C4E2781785F2A8583D49E367F3185732` |

`ffprobe` confirme pour les deux masters : ProRes 4444, `yuva444p12le`, 1920 × 1080, 60 i/s, timecode `01:00:00:00`, aucune piste audio. Le second flux est un flux de données timecode, pas de l’audio. La lecture fonctionnelle commence à `t = 0`.

## Correction alpha minimale

L’analyse 12 bits a mesuré, sur chaque image plein cadre, 1 027 pixels de la colonne gauche sous le maximum : minimum 3967/4095. Le pipeline force uniquement l’alpha de ces fenêtres à 4095 ; les pixels déjà opaques restent inchangés.

Sur la dernière image longue, le master contient encore 8 775 pixels non nuls, avec un maximum alpha de 1365/4095. Seule l’image 299 est forcée à alpha nul. La dernière image courte était déjà entièrement transparente.

L’analyse des contours est compatible avec des valeurs prémultipliées dans les masters. Aucune conversion globale `premultiply` ou `unpremultiply` n’est appliquée : les valeurs couleur/alpha sont préservées, puis contrôlées par composition sur damier, fond clair et fond sombre. Les planches se trouvent dans `captures/stinger-v2-audit/`.

## Dérivés

Le pipeline `scripts/prepare-stinger-v2.mjs` produit :

- le dérivé de diffusion sécurisé : deux séquences PNG RGBA 8 bits, extraites directement des masters ProRes 4444 12 bits, sans réencodage ProRes intermédiaire ;
- le dérivé d’aperçu : deux WebM VP9 lossless avec alpha, en chroma 4:2:0 pour la compatibilité navigateur ;
- deux vraies miniatures, dont celle du long montre le cartouche partenaires ;
- `manifest.json`, `verification.json` et un `SHA256SUMS.txt` par séquence.

Le proxy WebM sert uniquement au site et aux tests navigateur. Il ne doit pas remplacer la séquence PNG dans vMix.

Pour régénérer les livrables avec des chemins contenant des espaces :

```powershell
npm run export:stinger -- --short "C:\Users\maximed\Downloads\Stinger-V2-court-compressed.mov" --long "C:\Users\maximed\Downloads\Stinger-V2-Long-compressed.mov"
```

Résultats :

- `deliverables/stinger-principal-les/v2/court-2s/png-sequence/` ;
- `deliverables/stinger-principal-les/v2/long-5s/png-sequence/` ;
- `deliverables/stinger-principal-les/v2/manifest.json` ;
- `deliverables/stinger-principal-les/v2/verification.json` ;
- `public/assets/stinger/` pour les proxies web.

## Aperçu et banc de test

Ouvrir `/preview/stinger`. Ce banc est isolé du programme et propose :

- le choix `Court — 2 s` ou `Long — 5 s` ;
- la lecture normale et le ralenti ×0,25 ;
- le retour à zéro et le déplacement image/temps ;
- la visualisation de la coupe A → B à 1 300 ms ;
- les fonds sources A/B, damier alpha, clair, sombre et contraste.

Les sorties brutes sont `/output/stinger?variant=short` et `/output/stinger?variant=long`. Elles préchargent le média, refusent un second déclenchement pendant la lecture, ne bouclent pas et ne rejouent rien après une reconnexion.

Le cycle navigateur se teste avec :

```powershell
npm run test:stinger-browser -- --base-url http://localhost:3000
```

## Configuration vMix

Utiliser le mécanisme natif **Image Sequence / Stinger**, pas une Browser Source pour piloter la coupe.

1. Choisir un emplacement de stinger libre. Ne pas écraser un slot déjà occupé, notamment par le replay.
2. Ajouter la première image de la séquence voulue :
   - court : `stinger-les-court-2s-0001.png` ;
   - long : `stinger-les-long-5s-0001.png`.
3. Régler l’effet sur `Cut`.
4. Régler `Stinger Cut Point` sur `1300 ms` pour les deux variantes.
5. Régler `Duration` sur `2000 ms` pour le court ou `5000 ms` pour le long.
6. Laisser la vitesse à 1 et désactiver toute boucle.
7. Tester A → B sur une source claire, une source sombre et une mire fortement contrastée.
8. Vérifier le choix d’affichage au-dessus ou au-dessous des overlays sans modifier le synthé ni les éléments replay.

Le point de coupe est l’index 78 à 60 i/s. Il se situe après le début plein cadre à l’index 64 et avant le retrait, avec une marge suffisante dans les deux variantes.

Cette préparation ne publie rien automatiquement en production et ne modifie aucun slot vMix.
